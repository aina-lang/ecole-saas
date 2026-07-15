import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PouchDB from 'pouchdb';
import { getDbName } from './couchdb.constants';

@Injectable()
export class CouchDbService implements OnModuleDestroy {
  private readonly logger = new Logger(CouchDbService.name);
  private couchUrl: string;
  private couchUser: string;
  private couchPass: string;
  private dbCache = new Map<string, PouchDB.Database>();

  constructor(private configService: ConfigService) {
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

  getDb(entityType: string): PouchDB.Database {
    let db = this.dbCache.get(entityType);
    if (!db) {
      db = new PouchDB(`${this.getAuthUrl()}/${getDbName(entityType)}`);
      this.dbCache.set(entityType, db);
    }
    return db;
  }

  async writeDocument(entityType: string, doc: any): Promise<{ id: string; rev: string }> {
    const db = this.getDb(entityType);
    if (doc._id) {
      try { doc._rev = (await db.get(doc._id))._rev } catch {}
    }
    const result = await db.put(doc);
    return { id: result.id, rev: result.rev };
  }

  async deleteDocument(entityType: string, id: string): Promise<void> {
    const db = this.getDb(entityType);
    try {
      const doc = await db.get(id);
      await db.remove(doc);
    } catch (err: any) {
      if (err.status !== 404) throw err;
    }
  }

  async getDocument(entityType: string, id: string): Promise<any> {
    try {
      return await this.getDb(entityType).get(id);
    } catch { return null }
  }

  async getAllDocuments(entityType: string): Promise<any[]> {
    const result = await this.getDb(entityType).allDocs({ include_docs: true });
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
}
