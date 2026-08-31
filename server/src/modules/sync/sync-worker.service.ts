import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as PrismaClientPkg from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CouchDbService } from '../couchdb/couchdb.service';
import { SYNC_ENTITY_TYPES } from '../couchdb/couchdb.constants';
import PouchDB from 'pouchdb';

// Source unique côté serveur : couchdb.constants.ts (qui pilote aussi le
// provisioning des bases CouchDB et SYNCABLE_MODELS). Seul le pendant
// frontend (lib/db/pouchdb.ts) reste à aligner manuellement, faute de
// package partagé.
const ENTITIES = SYNC_ENTITY_TYPES;

/**
 * Métadonnées par modèle, dérivées du datamodel Prisma au chargement.
 * Remplace les tables maintenues à la main (champs inconnus par modèle,
 * conversions d'enums) : quand schema.prisma change, ceci suit tout seul.
 */
interface ModelMeta {
  /** Champs scalaires + enums acceptés en écriture. */
  writableFields: Set<string>;
  /** Champ enum → valeurs autorisées. */
  enumFields: Map<string, Set<string>>;
  /** Champs DateTime (seuls candidats à la normalisation de date). */
  dateFields: Set<string>;
  hasDeletedAt: boolean;
}

function buildModelMeta(): Map<string, ModelMeta> {
  const metas = new Map<string, ModelMeta>();
  for (const model of Prisma.dmmf.datamodel.models) {
    const writableFields = new Set<string>();
    const enumFields = new Map<string, Set<string>>();
    const dateFields = new Set<string>();
    for (const f of model.fields) {
      if (f.kind === 'scalar') {
        writableFields.add(f.name);
        if (f.type === 'DateTime') dateFields.add(f.name);
      } else if (f.kind === 'enum') {
        writableFields.add(f.name);
        // Les valeurs d'enum ne sont plus dans le dmmf (Prisma 7) mais le
        // client généré exporte chaque enum comme objet {VALEUR: 'VALEUR'}.
        const enumObj = (PrismaClientPkg as any)[f.type];
        enumFields.set(f.name, new Set(enumObj ? Object.values(enumObj) as string[] : []));
      }
    }
    metas.set(model.name, {
      writableFields,
      enumFields,
      dateFields,
      hasDeletedAt: writableFields.has('deletedAt'),
    });
  }
  return metas;
}

const MODEL_META = buildModelMeta();


// Champs à ne JAMAIS accepter d'un document client pour User : secrets de
// connexion (un client compromis ne doit pas pouvoir écraser un hash côté
// serveur). Ce sont des colonnes valides que sanitizeForModel laisserait
// passer — les champs non-colonnes (phones, teacher...) sont eux écartés
// par le sanitizer.
const USER_FORBIDDEN_FIELDS = [
  'password', 'passwordHash', 'refreshToken', 'twoFactorSecret', 'twoFactorEnabled',
];

function dbName(tenantId: string, entity: string): string {
  const tid = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `ecole-saas-${tid}-${entity.toLowerCase()}`;
}

// Checkpoint de feed persisté dans la base CouchDB elle-même : les documents
// _local/ ne sont jamais répliqués ni comptés dans les changements. Sans lui,
// le feed démarrait `since: 'now'` et tout changement émis pendant une
// indisponibilité du worker était définitivement perdu.
const CHECKPOINT_ID = '_local/sync-worker-checkpoint';

// Assez pour résoudre une chaîne de dépendances (ex: 12 niveaux liés par
// nextLevelId arrivant dans le pire ordre : chaque passe n'en débloque qu'un).
const FK_RETRY_MAX = 15;
const FK_RETRY_DELAY_MS = 15_000;

function stripMeta(doc: any) {
  const { _id, _rev, _deleted, _revisions, _attachments, ...rest } = doc;
  return { id: _id, ...rest };
}


@Injectable()
export class SyncWorkerService implements OnModuleInit {
  private readonly logger = new Logger(SyncWorkerService.name);
  private couchUrl: string;
  private couchUser: string;
  private couchPass: string;
  private feeds = new Map<string, any>();
  // Rafraîchi par pollTenants() toutes les 30s — évite une requête Postgres
  // par document reçu de CouchDB juste pour vérifier l'abonnement.
  private tenantStatus = new Map<string, string>();
  // _rev courant du checkpoint de chaque base (évite un get avant chaque put).
  private checkpointRevs = new Map<string, string>();
  // Throttle d'écriture du checkpoint : dernière seq en attente + timer.
  private checkpointPending = new Map<string, unknown>();
  private checkpointTimers = new Map<string, NodeJS.Timeout>();
  // Compteur de tentatives par document pour le retry sur FK manquante.
  private retryCounts = new Map<string, number>();
  // Tenants dont le SyncDevice synthétique du worker est déjà créé.
  private workerDevices = new Set<string>();
  // Tenants dont les User Postgres ont déjà été repoussés vers CouchDB
  // (backfill exécuté une fois par tenant et par démarrage).
  private backfilledUsers = new Set<string>();
  // Évite de répéter l'avertissement « CouchDB injoignable » à chaque poll.
  private couchDownLogged = false;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private couchdb: CouchDbService,
  ) {
    const url = this.configService.get<string>('couchdb.url') || 'http://localhost:5984';
    this.couchUrl = url.replace(/\/+$/, '');
    this.couchUser = this.configService.get<string>('couchdb.user') || '';
    this.couchPass = this.configService.get<string>('couchdb.pass') || '';
  }

  private getAuthUrl(): string {
    if (this.couchUser && this.couchPass) {
      return this.couchUrl.replace('://', `://${this.couchUser}:${encodeURIComponent(this.couchPass)}@`);
    }
    return this.couchUrl;
  }

  private entityModel(name: string) {
    // Nom du délégué Prisma = entité en camelCase (AuditLog → auditLog).
    // La validité est vérifiée au démarrage (assertEntitiesResolvable).
    return (this.prisma as any)[name[0].toLowerCase() + name.slice(1)];
  }

  /** Échoue bruyamment au boot si une entité ne correspond à aucun modèle. */
  private assertEntitiesResolvable(): void {
    for (const entity of ENTITIES) {
      if (!MODEL_META.has(entity) || !this.entityModel(entity)) {
        throw new Error(
          `[sync-worker] L'entité "${entity}" (couchdb.constants) ne correspond ` +
          `à aucun modèle Prisma — corriger la liste ou le schéma avant de démarrer.`,
        );
      }
    }
  }

  /**
   * Ne garde que les champs que le modèle Prisma connaît (un champ inconnu
   * ferait échouer l'upsert ENTIER — "Unknown argument" — et perdrait le
   * document), convertit les enums client minuscules ('paid', 'exam',
   * 'active'...) vers les valeurs Prisma, et normalise les dates
   * "YYYY-MM-DD" — uniquement sur les colonnes DateTime, pas sur les champs
   * texte qui ressembleraient à une date.
   * Dérivé du datamodel : suit automatiquement les évolutions du schéma.
   */
  private sanitizeForModel(entity: string, data: any): any {
    const meta = MODEL_META.get(entity);
    if (!meta) return { ...data };
    const out: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (!meta.writableFields.has(key)) continue;
      if (value != null && meta.enumFields.has(key)) {
        const upper = String(value).toUpperCase();
        // Valeur inconnue : laissée telle quelle pour que l'erreur soit
        // visible (SyncLog) plutôt que silencieusement transformée.
        out[key] = meta.enumFields.get(key)!.has(upper) ? upper : value;
        continue;
      }
      if (
        typeof value === 'string' &&
        meta.dateFields.has(key) &&
        /^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        out[key] = `${value}T00:00:00.000Z`;
        continue;
      }
      out[key] = value;
    }
    return out;
  }


  /** Id d'année scolaire valide en base : l'id reçu s'il existe, sinon l'année
   * de même libellé (document CouchDB), sinon l'année courante du tenant. */
  private async resolveAcademicYear(tenantId: string, id: any, data: any): Promise<string | null> {
    if (id) {
      const found = await this.prisma.academicYear.findFirst({ where: { id: String(id), tenantId }, select: { id: true } });
      if (found) return found.id;
      const label = data?.academicYearLabel || data?.academicYear?.label;
      if (label) {
        const byLabel = await this.prisma.academicYear.findFirst({ where: { tenantId, label: String(label) }, select: { id: true } });
        if (byLabel) return byLabel.id;
      }
    }
    const current = await this.prisma.academicYear.findFirst({ where: { tenantId, isCurrent: true }, select: { id: true } });
    return current?.id ?? null;
  }

  private async resolveTeacherUser(data: any, tenantId: string): Promise<string> {
    const email = data.user_email || data.email;
    if (!email) {
      throw new Error(`Cannot sync Teacher without email (id=${data.id})`);
    }
    let user = await this.prisma.user.findFirst({ where: { email, tenantId } });
    if (!user) {
      const id = crypto.randomUUID();
      user = await this.prisma.user.create({
        data: {
          id,
          tenantId,
          email,
          firstName: data.user_firstName || data.firstName || '',
          lastName: data.user_lastName || data.lastName || '',
          passwordHash: Math.random().toString(36).slice(2, 10) + 'A1!',
          role: 'TEACHER',
          isActive: true,
        },
      });
      this.logger.verbose(`Teacher sync: created User ${user.id} for ${email}`);
    }
    return user.id;
  }

  private async processChange(tenantId: string, entity: string, change: any) {
    if (!change.doc || change.doc._id.startsWith('_design/')) return;
    const data = stripMeta(change.doc);

    // Le tenantId provient EXCLUSIVEMENT de la base CouchDB écoutée (une base
    // par tenant, cf. startFeed) — jamais du corps du document. Le document
    // vient d'un appareil client ; un champ tenantId qu'il contiendrait n'est
    // qu'une donnée non fiable. Lui faire confiance permettrait à un appareil
    // légitimement autorisé sur SA PROPRE base CouchDB d'écrire malgré tout
    // des enregistrements dans un autre tenant en falsifiant ce champ.
    if (data.tenantId && data.tenantId !== tenantId) {
      this.logger.warn(
        `[sync-worker] ${entity}/${change.id}: tenantId du document (${data.tenantId}) ignoré — ` +
        `la base CouchDB interrogée appartient au tenant ${tenantId}.`
      );
    }
    data.tenantId = tenantId;

    // Garde-fou hors-ligne : un appareil peut continuer à écrire localement
    // (PouchDB) même en lecture seule — rien ne peut l'en empêcher tant qu'il
    // n'est pas reconnecté (voir frontend/src/lib/billing-status.ts pour le
    // blocage côté client, qui couvre le cas courant). Ce garde-fou referme la
    // boucle ici : au moment où ces changements atteignent enfin le serveur,
    // on refuse de les appliquer à Postgres si l'abonnement du tenant n'est
    // pas en règle. AuditLog reste exempté (simple journal, pas une donnée
    // métier — les entrées légitimes d'avant le passage en lecture seule
    // doivent quand même arriver).
    const status = this.tenantStatus.get(tenantId);
    if (entity !== 'AuditLog' && status && status !== 'ACTIVE' && status !== 'TRIAL') {
      this.logger.warn(
        `[sync-worker] ${entity}/${change.id}: tenant ${tenantId} en statut ${status} — écriture refusée (abonnement non en règle).`,
      );
      return;
    }

    if (entity === 'AuditLog' && data.timestamp) {
      // Ancien nom de champ côté client — remappé AVANT le sanitizer
      // (qui écarterait `timestamp`, inconnu du modèle).
      data.createdAt = data.timestamp;
      delete data.timestamp;
    }

    if (entity === 'User') {
      // Jamais de secrets en provenance d'un client : passwordHash & co sont
      // des colonnes VALIDES que le sanitizer laisserait passer — le doc
      // PouchDB peut contenir un mot de passe en clair hérité des anciens
      // formulaires.
      for (const f of USER_FORBIDDEN_FIELDS) delete data[f];
    }

    const model = this.entityModel(entity);

    if (change.deleted) {
      try {
        const existing = await (model as any).findFirst({ where: { id: change.id } });
        if (!existing) return;
        if (existing.tenantId !== tenantId) {
          this.logger.error(
            `[sync-worker] ${entity}/${change.id}: tenantId mismatch on delete — ` +
            `CouchDB dit tenantId=${tenantId}, PostgreSQL a tenantId=${existing.tenantId}. ` +
            `Suppression BLOQUÉE.`
          );
          return;
        }
        if (!MODEL_META.get(entity)?.hasDeletedAt) {
          // Pas de colonne deletedAt sur ce modèle : sans suppression
          // physique, la ligne resterait vivante en Postgres pour toujours
          // alors qu'elle a disparu de tous les clients.
          await model.delete({ where: { id: change.id } });
        } else {
          await model.update({ where: { id: change.id }, data: { deletedAt: new Date() } });
        }
      } catch (err: any) {
        await this.handleSyncFailure(tenantId, entity, change, err);
      }
      return;
    }

    try {
      const existing = await (model as any).findFirst({ where: { id: change.id } });
      if (existing && existing.tenantId !== tenantId) {
        this.logger.error(
          `[sync-worker] ${entity}/${change.id}: tenantId mismatch — ` +
          `CouchDB dit tenantId=${tenantId}, PostgreSQL a tenantId=${existing.tenantId}. ` +
          `Mise à jour BLOQUÉE (possible fuite de données inter-tenants).`
        );
        return;
      }

      // Filtre les champs inconnus du modèle (user_*, classIds, timestamps
      // absents...), convertit les enums, normalise les dates DateTime.
      const clean = this.sanitizeForModel(entity, data);

      if (entity === 'TenantSetting') {
        // _id client = clé du réglage ("school", "academic_year"...), fixe
        // dans chaque base tenant : impossible comme clé primaire globale.
        // Rangé sous "<tenantId>_<clé>", upsert sur l'unicité (tenantId, key).
        const settingKey = String(clean.key ?? change.id);
        delete clean.id;
        await model.upsert({
          where: { tenantId_key: { tenantId, key: settingKey } },
          create: { ...clean, id: `${tenantId}_${settingKey}`, key: settingKey, tenantId },
          update: { ...clean, key: settingKey },
        });
        this.logger.verbose(`[sync-worker] ${entity}/${change.id}: upsert OK`);
        this.retryCounts.delete(`${entity}/${change.id}`);
        return;
      }

      if (entity === 'AcademicYear') {
        // Unicité métier (tenantId, label) : l'onboarding rejoué sur un autre
        // poste crée un second document pour la même année → on rattache
        // tous les documents d'un même libellé à la même ligne Postgres
        // (le premier id arrivé fait foi).
        const label = String(clean.label ?? '');
        if (!label) throw new Error('AcademicYear sans label');
        delete clean.id;
        await model.upsert({
          where: { tenantId_label: { tenantId, label } },
          create: { ...clean, id: change.id, tenantId, label },
          update: { ...clean, label },
        });
        this.logger.verbose(`[sync-worker] ${entity}/${change.id}: upsert OK`);
        this.retryCounts.delete(`${entity}/${change.id}`);
        return;
      }

      if (entity === 'GradeConfig') {
        // L'_id client est fixe ("grade_config", identique dans chaque base
        // tenant) : impossible comme clé primaire globale Postgres. On range
        // la ligne sous un id par tenant et l'upsert porte sur l'unicité
        // tenantId.
        delete clean.id;
        await model.upsert({
          where: { tenantId },
          create: { ...clean, id: `${tenantId}_grade_config`, tenantId },
          update: { ...clean },
        });
        this.logger.verbose(`[sync-worker] ${entity}/${change.id}: upsert OK`);
        this.retryCounts.delete(`${entity}/${change.id}`);
        return;
      }

      if (entity === 'Message') {
        // `recipients` côté client est un tableau d'ids utilisateur — pas une
        // colonne (le sanitizer l'a écarté de `clean`) : on le transforme en
        // créations MessageRecipient. senderId est obligatoire côté Prisma ;
        // les messages antérieurs à son ajout côté client restent répliqués
        // entre postes mais ne peuvent pas être persistés ici.
        const recipientIds: string[] = Array.isArray(data.recipients)
          ? data.recipients.filter((r: any) => typeof r === 'string' && r)
          : [];
        const senderId = clean.senderId;
        if (!senderId) {
          this.logger.warn(
            `[sync-worker] Message/${change.id}: senderId absent — non persisté en Postgres.`,
          );
          return;
        }
        delete clean.senderId;
        delete clean.tenantId;
        await model.upsert({
          where: { id: change.id },
          create: {
            ...clean,
            id: change.id,
            tenant: { connect: { id: tenantId } },
            sender: { connect: { id: senderId } },
            recipients: {
              create: recipientIds.map((userId) => ({ user: { connect: { id: userId } } })),
            },
          },
          // En update : contenu seul — les destinataires d'un message envoyé
          // ne changent pas, et un deleteMany/create à chaque passage
          // écraserait les statuts de lecture.
          update: { ...clean },
        });
        this.logger.verbose(`[sync-worker] ${entity}/${change.id}: upsert OK`);
        this.retryCounts.delete(`${entity}/${change.id}`);
        return;
      }


      // Mode « unchecked » : toutes les FK restent des scalaires (tenantId
      // compris), null vide un lien. Dès qu'un seul `connect` est présent,
      // Prisma bascule en mode « checked » et rejette TOUT FK scalaire non
      // converti ("Unknown argument nextLevelId") — une table de conversion
      // à la main ne peut pas être exhaustive (nextLevelId, levelId,
      // feeStructureId, timetableSlotId...). Les contraintes FK sont
      // vérifiées par PostgreSQL (P2003 → retry, cf. handleSyncFailure).
      for (const key of Object.keys(clean)) {
        if (key.endsWith('Id') && clean[key] === '') clean[key] = null;
      }
      clean.tenantId = tenantId;

      if (entity === 'Teacher') {
        clean.userId = await this.resolveTeacherUser(data, tenantId);
      }

      // Références vers l'année scolaire / la période : les postes utilisent
      // leurs propres ids de documents (l'année est fusionnée par libellé côté
      // serveur, les périodes de bulletin sont locales « 1/2/3 »). Une FK
      // inconnue faisait échouer le document 15 fois puis l'abandonnait —
      // notes, paiements, inscriptions n'arrivaient jamais en base.
      if ('academicYearId' in clean) {
        clean.academicYearId = await this.resolveAcademicYear(tenantId, clean.academicYearId, data);
        if (!clean.academicYearId && entity !== 'StudentEnrollment') delete clean.academicYearId;
      }
      if ('periodId' in clean && clean.periodId) {
        const period = await this.prisma.period.findFirst({ where: { id: String(clean.periodId) }, select: { id: true } });
        if (!period) clean.periodId = null;
      }

      // passwordHash est obligatoire sur User mais banni des documents
      // clients : à la création on pose une sentinelle vide (aucun bcrypt ne
      // matchera — le compte ne peut pas se connecter tant qu'un mot de passe
      // n'est pas défini en ligne). Jamais touché en update.
      const createExtra = entity === 'User' ? { passwordHash: '' } : {};

      // User : l'e-mail est une clé naturelle (unique par établissement). Un
      // document local créé hors ligne pour un compte qui existe déjà en ligne
      // sous un autre id (créé via l'API, ou sur un autre poste) ne doit pas
      // produire un second compte : on met à jour le compte existant.
      if (entity === 'User' && clean.email) {
        const email = String(clean.email).trim().toLowerCase();
        const dup = await this.prisma.user.findFirst({
          where: { tenantId, email, NOT: { id: change.id } },
          select: { id: true },
        });
        if (dup) {
          const { id: _ignored, ...rest } = clean;
          await model.update({ where: { id: dup.id }, data: { ...rest, email } });
          this.logger.log(`[sync-worker] User/${change.id}: e-mail ${email} déjà porté par ${dup.id} — compte existant mis à jour, pas de doublon`);
          this.retryCounts.delete(`${entity}/${change.id}`);
          return;
        }
        clean.email = email;
      }

      await model.upsert({
        where: { id: change.id },
        create: { ...clean, id: change.id, ...createExtra },
        update: { ...clean },
      });

      // Teacher : classIds / subjectIds du document client sont des relations
      // many-to-many en Postgres (pas des colonnes) — on les pose ici, en ne
      // gardant que les ids connus du tenant (une classe pas encore
      // synchronisée arrivera par son propre flux).
      if (entity === 'Teacher' && (Array.isArray(data.classIds) || Array.isArray(data.subjectIds))) {
        const rel: any = {};
        if (Array.isArray(data.classIds)) {
          const found = await this.prisma.class.findMany({ where: { tenantId, id: { in: data.classIds } }, select: { id: true } });
          rel.classes = { set: found.map((c) => ({ id: c.id })) };
        }
        if (Array.isArray(data.subjectIds)) {
          const found = await this.prisma.subject.findMany({ where: { tenantId, id: { in: data.subjectIds } }, select: { id: true } });
          rel.subjects = { set: found.map((c) => ({ id: c.id })) };
        }
        await this.prisma.teacher.update({ where: { id: change.id }, data: rel });
      }
      this.logger.verbose(`[sync-worker] ${entity}/${change.id}: upsert OK`);
      this.retryCounts.delete(`${entity}/${change.id}`);
    } catch (err: any) {
      await this.handleSyncFailure(tenantId, entity, change, err);
    }
  }

  /**
   * Échec d'application d'un changement CouchDB → PostgreSQL.
   *
   * FK manquante (P2025/P2003) : les feeds sont concurrents (un par entité),
   * la cible (Student d'une Grade, etc.) peut simplement ne pas être encore
   * arrivée — on rejoue le document quelques fois avant d'abandonner.
   * Échec définitif : enregistré dans SyncLog (status ERROR) pour être
   * visible côté admin au lieu de disparaître dans les logs serveur.
   */
  private async handleSyncFailure(tenantId: string, entity: string, change: any, err: any) {
    const key = `${entity}/${change.id}`;
    const retryable = err?.code === 'P2025' || err?.code === 'P2003';
    const attempt = (this.retryCounts.get(key) ?? 0) + 1;
    if (retryable && attempt <= FK_RETRY_MAX) {
      this.retryCounts.set(key, attempt);
      this.logger.warn(`sync ${key}: dépendance manquante (${err.code}), retry ${attempt}/${FK_RETRY_MAX} dans ${FK_RETRY_DELAY_MS / 1000}s`);
      setTimeout(() => this.processChange(tenantId, entity, change), FK_RETRY_DELAY_MS);
      return;
    }
    this.retryCounts.delete(key);
    this.logger.error(`sync ${key}: ${err.message}`);
    await this.recordReject(tenantId, entity, change, err);
  }

  private async recordReject(tenantId: string, entity: string, change: any, err: any) {
    try {
      // SyncLog.deviceId est une FK obligatoire vers SyncDevice : on rattache
      // les rejets du worker à un appareil synthétique par tenant.
      const deviceId = `server-worker-${tenantId}`;
      if (!this.workerDevices.has(tenantId)) {
        await this.prisma.syncDevice.upsert({
          where: { deviceId },
          create: { tenantId, deviceId, deviceName: 'Worker de synchronisation' },
          update: {},
        });
        this.workerDevices.add(tenantId);
      }
      await this.prisma.syncLog.create({
        data: {
          tenantId,
          deviceId,
          entityType: entity,
          entityId: change.id,
          operation: change.deleted ? 'DELETE' : 'UPDATE',
          payload: change.doc ?? {},
          status: 'ERROR',
          errorMessage: String(err?.message ?? err).slice(0, 2000),
        },
      });
    } catch (logErr: any) {
      this.logger.error(`recordReject ${entity}/${change.id}: ${logErr.message}`);
    }
  }

  private async startFeed(tenantId: string, entity: string) {
    const dbStr = dbName(tenantId, entity);
    if (this.feeds.has(dbStr)) return;

    const url = `${this.getAuthUrl()}/${dbStr}`;
    const db = new PouchDB(url);

    try {
      await db.info();
    } catch {
      const headers: Record<string, string> = {};
      if (this.couchUser && this.couchPass) {
        headers['Authorization'] = `Basic ${Buffer.from(`${this.couchUser}:${this.couchPass}`).toString('base64')}`;
      }
      try {
        await fetch(`${this.couchUrl}/${dbStr}`, { method: 'PUT', headers });
      } catch {
        this.logger.warn(`CouchDB database ${dbStr} not available, retrying in 10s`);
        setTimeout(() => this.startFeed(tenantId, entity), 10000);
        return;
      }
    }

    // Reprise depuis le dernier checkpoint ; à défaut on repart de 0 (rejeu
    // complet — les upserts sont idempotents, seul le premier démarrage après
    // déploiement paie ce coût).
    let since: string | number = 0;
    try {
      const cp: any = await db.get(CHECKPOINT_ID);
      since = cp.seq ?? 0;
      this.checkpointRevs.set(dbStr, cp._rev);
    } catch { /* pas encore de checkpoint */ }

    const feed = db.changes({ since, live: true, include_docs: true, heartbeat: 10000 });
    // Chaîne de promesses : les changements sont traités dans l'ordre du feed
    // et le checkpoint n'avance qu'une fois le changement traité.
    let chain: Promise<void> = Promise.resolve();
    feed.on('change', (change) => {
      chain = chain
        .then(() => this.processChange(tenantId, entity, change))
        .then(() => this.scheduleCheckpoint(db, dbStr, change.seq))
        .catch((err: any) => this.logger.error(`feed ${dbStr}: ${err.message}`));
    });
    feed.on('error', () => {
      this.feeds.delete(dbStr);
      setTimeout(() => this.startFeed(tenantId, entity), 5000);
    });
    this.feeds.set(dbStr, feed);
    this.logger.log(`Sync worker watching ${dbStr} (since=${since})`);
  }

  /**
   * Écrit le checkpoint au plus une fois toutes les 2 s par base (trailing) :
   * un PUT par document doublait le trafic CouchDB, surtout au premier rejeu
   * complet. Au pire un crash rejoue ~2 s de changements — les upserts sont
   * idempotents.
   */
  private scheduleCheckpoint(db: any, dbStr: string, seq: unknown): void {
    if (seq == null) return;
    this.checkpointPending.set(dbStr, seq);
    if (this.checkpointTimers.has(dbStr)) return;
    this.checkpointTimers.set(dbStr, setTimeout(() => {
      this.checkpointTimers.delete(dbStr);
      const pending = this.checkpointPending.get(dbStr);
      this.checkpointPending.delete(dbStr);
      void this.saveCheckpoint(db, dbStr, pending);
    }, 2000));
  }

  private async saveCheckpoint(db: any, dbStr: string, seq: unknown): Promise<void> {
    if (seq == null) return;
    const doc: any = { _id: CHECKPOINT_ID, seq };
    const rev = this.checkpointRevs.get(dbStr);
    if (rev) doc._rev = rev;
    try {
      const res = await db.put(doc);
      this.checkpointRevs.set(dbStr, res.rev);
    } catch (err: any) {
      if (err?.status === 409) {
        // _rev périmé (ex: worker redémarré en parallèle) : on le relit et on
        // retente une fois.
        try {
          const cur: any = await db.get(CHECKPOINT_ID);
          doc._rev = cur._rev;
          const res = await db.put(doc);
          this.checkpointRevs.set(dbStr, res.rev);
        } catch (retryErr: any) {
          this.logger.warn(`checkpoint ${dbStr}: ${retryErr.message}`);
        }
      } else {
        this.logger.warn(`checkpoint ${dbStr}: ${err.message}`);
      }
    }
  }

  private async pollTenants() {
    try {
      const tenants = await this.prisma.tenant.findMany({ select: { id: true, status: true } });
      for (const tenant of tenants) this.tenantStatus.set(tenant.id, tenant.status);

      // CouchDB injoignable : un seul avertissement par cycle, pas de
      // provisioning ni de nouveaux feeds (les feeds déjà ouverts se
      // reconnectent seuls). On réessaie au prochain poll (30 s).
      if (!(await this.couchdb.isConnected())) {
        if (!this.couchDownLogged) {
          this.logger.warn(`CouchDB injoignable (${this.couchUrl}) — worker en attente, nouvel essai toutes les 30 s`);
          this.couchDownLogged = true;
        }
        setTimeout(() => this.pollTenants(), 30000);
        return;
      }
      if (this.couchDownLogged) {
        this.logger.log('CouchDB de nouveau joignable — reprise du provisioning et des feeds');
        this.couchDownLogged = false;
      }

      for (const tenant of tenants) {

        // Assure l'utilisateur CouchDB scopé + les _security de ce tenant avant
        // d'écouter ses bases (auto-réparateur si un _security a été perdu/pas
        // encore posé — cf. CouchDbService.ensureTenantProvisioned).
        await this.couchdb.ensureTenantProvisioned(tenant.id).catch((err: any) =>
          this.logger.error(`Provisioning CouchDB du tenant ${tenant.id} échoué: ${err.message}`),
        );

        // Backfill ponctuel : repousse tous les User Postgres vers CouchDB.
        // Répare notamment les documents User vidés par l'ancien bug
        // d'écrasement de saveEntity côté client (le doc local ne contenait
        // plus que {id, isActive}) — Postgres a conservé les champs complets,
        // et writeDocument remplace le doc CouchDB, qui redescend ensuite
        // vers les postes par réplication (le doc serveur, plus récent, gagne
        // l'arbitrage de conflit).
        if (!this.backfilledUsers.has(tenant.id)) {
          this.backfilledUsers.add(tenant.id);
          this.prisma.user
            .findMany({
              where: { tenantId: tenant.id },
              include: { phones: { select: { value: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } } },
            })
            .then((users) => {
              for (const u of users) this.prisma.notifyWrite('User', u);
              if (users.length) this.logger.log(`Backfill User → CouchDB : ${users.length} comptes (tenant ${tenant.id})`);
            })
            .catch((err: any) => {
              this.backfilledUsers.delete(tenant.id);
              this.logger.error(`Backfill User du tenant ${tenant.id} échoué: ${err.message}`);
            });
        }
        for (const entity of ENTITIES) {
          this.startFeed(tenant.id, entity);
        }
      }
    } catch (err: any) {
      this.logger.error(`Error polling tenants: ${err.message}`);
    }
    setTimeout(() => this.pollTenants(), 30000);
  }

  /**
   * Rejoue au démarrage les documents rejetés (SyncLog ERROR) : après un
   * correctif du worker, les documents déjà passés dans le feed (checkpoint
   * avancé) ne reviendraient jamais sinon. Chaque ligne est supprimée avant
   * rejeu — un nouvel échec la recrée avec l'erreur à jour.
   */
  private async replayRejects(): Promise<void> {
    const rejects = await this.prisma.syncLog.findMany({
      where: { status: 'ERROR' },
      orderBy: { createdAt: 'asc' },
      take: 2000,
    });
    if (!rejects.length) return;
    this.logger.log(`Rejeu de ${rejects.length} document(s) rejeté(s) précédemment`);
    let ok = 0;
    for (const r of rejects) {
      if (!(ENTITIES as readonly string[]).includes(r.entityType)) continue;
      await this.prisma.syncLog.delete({ where: { id: r.id } }).catch(() => {});
      const before = await this.prisma.syncLog.count({ where: { entityId: r.entityId, status: 'ERROR' } });
      await this.processChange(r.tenantId, r.entityType, {
        id: r.entityId,
        doc: r.payload,
        deleted: r.operation === 'DELETE',
      });
      const after = await this.prisma.syncLog.count({ where: { entityId: r.entityId, status: 'ERROR' } });
      if (after <= before) ok++;
    }
    this.logger.log(`Rejeu terminé : ${ok}/${rejects.length} document(s) appliqué(s)`);
  }

  async onModuleInit() {
    this.assertEntitiesResolvable();
    this.replayRejects().catch((err: any) => this.logger.error(`Rejeu des rejets échoué: ${err.message}`));
    this.pollTenants();
    this.logger.log(`Sync worker started — CouchDB → PostgreSQL (${ENTITIES.length} entités)`);
  }
}
