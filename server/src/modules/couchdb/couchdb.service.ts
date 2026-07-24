import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PouchDB from 'pouchdb';
import { randomBytes } from 'crypto';
import { getDbName, SYNC_ENTITY_TYPES } from './couchdb.constants';
import { PrismaService } from '../../common/prisma/prisma.service';
import { encryptSecret, decryptSecret } from '../../common/utils/crypto.util';

@Injectable()
export class CouchDbService implements OnModuleDestroy {
  private readonly logger = new Logger(CouchDbService.name);
  private couchUrl: string;
  private couchUser: string;
  private couchPass: string;
  private dbCache = new Map<string, PouchDB.Database>();
  private provisioningInFlight = new Map<string, Promise<{ user: string; pass: string }>>();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const url = this.configService.get<string>('couchdb.url') || 'http://localhost:5984';
    this.couchUrl = url.replace(/\/+$/, '');
    this.couchUser = this.configService.get<string>('couchdb.user') || '';
    this.couchPass = this.configService.get<string>('couchdb.pass') || '';
  }

  onModuleDestroy() {
    for (const [, db] of this.dbCache) db.close();
  }

  private getAuthUrl(): string {
    if (this.couchUser && this.couchPass) {
      return this.couchUrl.replace('://', `://${this.couchUser}:${encodeURIComponent(this.couchPass)}@`);
    }
    return this.couchUrl;
  }

  getDb(tenantId: string, entityType: string): PouchDB.Database {
    const dbKey = `${tenantId}_${entityType}`;
    let db = this.dbCache.get(dbKey);
    if (!db) {
      db = new PouchDB(`${this.getAuthUrl()}/${getDbName(tenantId, entityType)}`);
      this.dbCache.set(dbKey, db);
    }
    return db;
  }

  async writeDocument(tenantId: string, entityType: string, doc: any): Promise<{ id: string; rev: string }> {
    const db = this.getDb(tenantId, entityType);
    if (doc._id) {
      try { doc._rev = (await db.get(doc._id))._rev } catch {}
    }
    const result = await db.put(doc);
    return { id: result.id, rev: result.rev };
  }

  async deleteDocument(tenantId: string, entityType: string, id: string): Promise<void> {
    const db = this.getDb(tenantId, entityType);
    try {
      const doc = await db.get(id);
      await db.remove(doc);
    } catch (err: any) {
      if (err.status !== 404) throw err;
    }
  }

  async getDocument(tenantId: string, entityType: string, id: string): Promise<any> {
    try {
      return await this.getDb(tenantId, entityType).get(id);
    } catch { return null }
  }

  async getAllDocuments(tenantId: string, entityType: string): Promise<any[]> {
    const result = await this.getDb(tenantId, entityType).allDocs({ include_docs: true });
    return result.rows.map((r: any) => r.doc).filter((d: any) => d && !d._id?.startsWith('_design/'));
  }

  async isConnected(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (this.couchUser && this.couchPass) {
        headers['Authorization'] = `Basic ${Buffer.from(`${this.couchUser}:${this.couchPass}`).toString('base64')}`;
      }
      const res = await fetch(this.couchUrl, { headers });
      return res.ok;
    } catch { return false }
  }

  // ─── Isolation multi-tenant CouchDB ──────────────────────────────────────
  // Chaque tenant obtient son propre utilisateur CouchDB, confiné par un
  // document _security à ses seules bases. Le compte admin global
  // (this.couchUser/this.couchPass) ne quitte jamais le serveur : c'est lui
  // qui sert à provisionner, jamais ce qu'on renvoie à un client.

  private adminAuthHeader(): Record<string, string> {
    if (!this.couchUser || !this.couchPass) return {};
    return {
      Authorization: `Basic ${Buffer.from(`${this.couchUser}:${this.couchPass}`).toString('base64')}`,
    };
  }

  private couchUserName(tenantId: string): string {
    return `tenant_${tenantId}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }

  private async ensureUsersDb(): Promise<void> {
    // Base système attendue par CouchDB pour l'authentification — absente sur
    // une installation fraîche tant que le setup single-node n'a pas été
    // finalisé. PUT est idempotent (404/412 si déjà là, ignoré).
    await fetch(`${this.couchUrl}/_users`, {
      method: 'PUT',
      headers: this.adminAuthHeader(),
    }).catch(() => {});
  }

  private async putCouchUser(name: string, password: string): Promise<void> {
    await this.ensureUsersDb();
    const docId = `org.couchdb.user:${name}`;
    const res = await fetch(`${this.couchUrl}/_users/${encodeURIComponent(docId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...this.adminAuthHeader() },
      body: JSON.stringify({ name, password, roles: [], type: 'user' }),
    });
    if (!res.ok && res.status !== 409) {
      const body = await res.text().catch(() => '');
      throw new Error(`Création utilisateur CouchDB ${name} échouée (${res.status}): ${body}`);
    }
  }

  private async ensureDatabaseSecurity(tenantId: string, entityType: string, couchUser: string): Promise<void> {
    const db = getDbName(tenantId, entityType);
    // Idempotent : 201 si créée, 412 si déjà existante — les deux sont acceptables.
    await fetch(`${this.couchUrl}/${db}`, {
      method: 'PUT',
      headers: this.adminAuthHeader(),
    }).catch(() => {});

    const res = await fetch(`${this.couchUrl}/${db}/_security`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...this.adminAuthHeader() },
      // Restreint la base à ce seul utilisateur (les comptes admin CouchDB
      // globaux gardent toujours accès, indépendamment de _security — c'est
      // ce qui permet au worker et à ce service de continuer à lire/écrire).
      body: JSON.stringify({ members: { names: [couchUser], roles: [] }, admins: { names: [], roles: [] } }),
    });
    if (!res.ok) {
      this.logger.warn(`_security non appliqué sur ${db} (${res.status})`);
    }
  }

  /** Récupère (ou crée) les identifiants CouchDB scopés à ce tenant. Idempotent. */
  async ensureTenantAccess(tenantId: string): Promise<{ user: string; pass: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { couchDbUser: true, couchDbPasswordEnc: true },
    });
    if (tenant?.couchDbUser && tenant?.couchDbPasswordEnc) {
      return { user: tenant.couchDbUser, pass: decryptSecret(tenant.couchDbPasswordEnc) };
    }

    // Concurrence : deux requêtes simultanées pour le même tenant ne doivent
    // pas créer deux utilisateurs CouchDB différents.
    const existing = this.provisioningInFlight.get(tenantId);
    if (existing) return existing;

    const task = (async () => {
      const user = this.couchUserName(tenantId);
      const pass = randomBytes(24).toString('base64url');
      await this.putCouchUser(user, pass);
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { couchDbUser: user, couchDbPasswordEnc: encryptSecret(pass) },
      });
      this.logger.log(`Utilisateur CouchDB provisionné pour le tenant ${tenantId}`);
      return { user, pass };
    })();
    this.provisioningInFlight.set(tenantId, task);
    try {
      return await task;
    } finally {
      this.provisioningInFlight.delete(tenantId);
    }
  }

  /** Assure l'utilisateur ET les _security de toutes les bases synchronisées du tenant. */
  async ensureTenantProvisioned(tenantId: string): Promise<{ user: string; pass: string }> {
    const { user, pass } = await this.ensureTenantAccess(tenantId);
    await Promise.all(
      SYNC_ENTITY_TYPES.map((entity) =>
        this.ensureDatabaseSecurity(tenantId, entity, user).catch((err) =>
          this.logger.warn(`_security ${entity}/${tenantId} échoué: ${err.message}`),
        ),
      ),
    );
    return { user, pass };
  }
}
