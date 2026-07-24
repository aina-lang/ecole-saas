import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CouchDbService } from '../couchdb/couchdb.service';
import PouchDB from 'pouchdb';

// Doit rester alignée avec SYNC_ENTITY_TYPES (frontend/src/lib/db/sync-engine.ts),
// SYNCABLE_MODELS (common/prisma/prisma.service.ts) et SYNC_ENTITY_TYPES
// (modules/couchdb/couchdb.constants.ts).
const ENTITIES = [
  'Student', 'Grade', 'Attendance', 'Class', 'Subject', 'Teacher',
  'Payment', 'FeeStructure', 'Message', 'TimetableSlot',
  'TeacherContract', 'TeacherPayment', 'TeacherAttendance', 'AuditLog', 'Level',
] as const;

function dbName(tenantId: string, entity: string): string {
  const tid = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `ecole-saas-${tid}-${entity.toLowerCase()}`;
}

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
    const map: Record<string, string> = {
      Student: 'student', Grade: 'grade', Attendance: 'attendance',
      Class: 'class', Subject: 'subject', Teacher: 'teacher',
      Payment: 'payment', FeeStructure: 'feeStructure',
      Message: 'message', TimetableSlot: 'timetableSlot',
      TeacherAttendance: 'teacherAttendance',
      TeacherContract: 'teacherContract', TeacherPayment: 'teacherPayment',
      AuditLog: 'auditLog', Level: 'level',
    };
    return this.prisma[map[name]] as any;
  }

  private stripFlattened(data: any): any {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('user_')) continue;
      if (key === 'classIds' || key === 'subjectIds') continue;
      cleaned[key] = value;
    }
    return cleaned;
  }

  private connectRelations(data: any): any {
    const relations: Record<string, string> = {
      classId: 'class',
      studentId: 'student',
      subjectId: 'subject',
      teacherId: 'teacher',
      userId: 'user',
      periodId: 'period',
      academicYearId: 'academicYear',
    };
    for (const [fk, rel] of Object.entries(relations)) {
      if (data[fk]) {
        data[rel] = { connect: { id: data[fk] } };
        delete data[fk];
      }
    }
    return data;
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

    for (const key of Object.keys(data)) {
      if (typeof data[key] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data[key])) {
        data[key] = `${data[key]}T00:00:00.000Z`;
      }
    }

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

    if (entity === 'AuditLog') {
      delete data.userName;
      delete data.userEmail;
      if (data.timestamp) {
        data.createdAt = data.timestamp;
        delete data.timestamp;
      }
    }

    const model = this.entityModel(entity);

    if (change.deleted) {
      try {
        const existing = await (model as any).findFirst({ where: { id: change.id } });
        if (existing && existing.tenantId !== tenantId) {
          this.logger.error(
            `[sync-worker] ${entity}/${change.id}: tenantId mismatch on delete — ` +
            `CouchDB dit tenantId=${tenantId}, PostgreSQL a tenantId=${existing.tenantId}. ` +
            `Suppression BLOQUÉE.`
          );
          return;
        }
        await model.update({ where: { id: change.id }, data: { deletedAt: new Date() } });
      }
      catch {}
      return;
    }

    const PAYMENT_STATUS_MAP: Record<string, string> = {
      pending: 'PENDING', partial: 'PARTIAL', paid: 'PAID', overdue: 'OVERDUE',
      cancelled: 'CANCELLED', refunded: 'REFUNDED',
    }
    const FEE_TYPE_MAP: Record<string, string> = {
      tuition: 'TUITION', annual: 'ANNUAL', other: 'OTHER',
    }

    if (entity === 'Payment' && data.status) {
      data.status = PAYMENT_STATUS_MAP[data.status.toLowerCase()] || data.status
    }
    if (entity === 'FeeStructure' && data.feeType) {
      data.feeType = FEE_TYPE_MAP[data.feeType.toLowerCase()] || data.feeType
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

      const clean = this.stripFlattened(data);
      this.connectRelations(clean);
      // Comme connectRelations() le fait déjà pour les autres FK (classId,
      // studentId, userId...), on ne garde qu'UNE forme pour le tenant : soit
      // le scalaire tenantId, soit la relation tenant:{connect}, jamais les
      // deux — Prisma rejette un create qui mélange les deux formes pour la
      // même relation ("Unknown argument tenantId. Did you mean tenant?").
      delete clean.tenantId;

      if (entity === 'Teacher') {
        const userId = await this.resolveTeacherUser(data, tenantId);
        clean.userId = userId;
      }

      const createData = { ...clean, id: change.id, tenant: { connect: { id: tenantId } } };
      const updateData = { ...clean };

      await model.upsert({
        where: { id: change.id },
        create: createData,
        update: updateData,
      });
      this.logger.verbose(`[sync-worker] ${entity}/${change.id}: upsert OK`);
    } catch (err: any) {
      this.logger.error(`sync ${entity}/${change.id}: ${err.message}`);
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

    const feed = db.changes({ since: 'now', live: true, include_docs: true, heartbeat: 10000 });
    feed.on('change', (change) => this.processChange(tenantId, entity, change));
    feed.on('error', () => {
      this.feeds.delete(dbStr);
      setTimeout(() => this.startFeed(tenantId, entity), 5000);
    });
    this.feeds.set(dbStr, feed);
    this.logger.log(`Sync worker watching ${dbStr}`);
  }

  private async pollTenants() {
    try {
      const tenants = await this.prisma.tenant.findMany({ select: { id: true, status: true } });
      for (const tenant of tenants) {
        this.tenantStatus.set(tenant.id, tenant.status);

        // Assure l'utilisateur CouchDB scopé + les _security de ce tenant avant
        // d'écouter ses bases (auto-réparateur si un _security a été perdu/pas
        // encore posé — cf. CouchDbService.ensureTenantProvisioned).
        await this.couchdb.ensureTenantProvisioned(tenant.id).catch((err: any) =>
          this.logger.error(`Provisioning CouchDB du tenant ${tenant.id} échoué: ${err.message}`),
        );
        for (const entity of ENTITIES) {
          this.startFeed(tenant.id, entity);
        }
      }
    } catch (err: any) {
      this.logger.error(`Error polling tenants: ${err.message}`);
    }
    setTimeout(() => this.pollTenants(), 30000);
  }

  async onModuleInit() {
    this.pollTenants();
    this.logger.log(`Sync worker started — CouchDB → PostgreSQL`);
  }
}
