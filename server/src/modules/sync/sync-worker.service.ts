import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import PouchDB from 'pouchdb';

const ENTITIES = [
  'Student', 'Grade', 'Attendance', 'Class', 'Subject', 'Teacher',
  'Payment', 'FeeStructure', 'Message', 'TimetableSlot',
  'TeacherContract', 'TeacherPayment', 'TeacherAttendance',
] as const;

function dbName(entity: string): string {
  return `ecole-saas-${entity.toLowerCase()}`;
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

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
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

  private async processChange(entity: string, change: any) {
    if (!change.doc || change.doc._id.startsWith('_design/')) return;
    const data = stripMeta(change.doc);

    for (const key of Object.keys(data)) {
      if (typeof data[key] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data[key])) {
        data[key] = `${data[key]}T00:00:00.000Z`;
      }
    }

    const tenantId = data.tenantId || data.tenant_id;

    if (!tenantId) {
      this.logger.warn(
        `[sync-worker] ${entity}/${change.id}: tenantId absent — document IGNORÉ. ` +
        `Vérifier que le frontend injecte tenantId avant l'écriture PouchDB.`
      );
      return;
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

      if (entity === 'Teacher') {
        const userId = await this.resolveTeacherUser(data, tenantId);
        clean.userId = userId;
      }

      await model.upsert({
        where: { id: change.id },
        create: { ...clean, id: change.id, tenantId, tenant: { connect: { id: tenantId } } },
        update: clean,
      });
      this.logger.verbose(`[sync-worker] ${entity}/${change.id}: upsert OK`);
    } catch (err: any) {
      this.logger.error(`sync ${entity}/${change.id}: ${err.message}`);
    }
  }

  private async startFeed(entity: string) {
    if (this.feeds.has(entity)) return;

    const url = `${this.getAuthUrl()}/${dbName(entity)}`;
    const db = new PouchDB(url);

    try {
      await db.info();
    } catch {
      const headers: Record<string, string> = {};
      if (this.couchUser && this.couchPass) {
        headers['Authorization'] = `Basic ${Buffer.from(`${this.couchUser}:${this.couchPass}`).toString('base64')}`;
      }
      try {
        await fetch(`${this.couchUrl}/${dbName(entity)}`, { method: 'PUT', headers });
      } catch {
        this.logger.warn(`CouchDB database ${dbName(entity)} not available, retrying in 10s`);
        setTimeout(() => this.startFeed(entity), 10000);
        return;
      }
    }

    const feed = db.changes({ since: 'now', live: true, include_docs: true, heartbeat: 10000 });
    feed.on('change', (change) => this.processChange(entity, change));
    feed.on('error', () => setTimeout(() => this.startFeed(entity), 5000));
    this.feeds.set(entity, feed);
    this.logger.log(`Sync worker watching ${dbName(entity)}`);
  }

  async onModuleInit() {
    for (const entity of ENTITIES) {
      this.startFeed(entity);
    }
    this.logger.log(`Sync worker started — CouchDB → PostgreSQL`);
  }
}
