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

  private async processChange(entity: string, change: any) {
    if (!change.doc || change.doc._id.startsWith('_design/')) return;
    const data = stripMeta(change.doc);
    const tenantId = data.tenantId || data.tenant_id;
    if (!tenantId) return;

    const model = this.entityModel(entity);

    if (change.deleted) {
      try { await model.update({ where: { id: change.id }, data: { deletedAt: new Date() } }); }
      catch {}
      return;
    }

    try {
      await model.upsert({
        where: { id: change.id },
        create: { ...data, id: change.id, tenantId },
        update: data,
      });
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
