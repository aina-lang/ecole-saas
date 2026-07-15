import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Modèles Prisma dont les mutations doivent être propagées vers CouchDB
 * pour que les clients PouchDB reçoivent les changements en pull (rupture #5 fix).
 */
export const SYNCABLE_MODELS = new Set([
  'Student', 'Grade', 'Attendance', 'Class', 'Subject', 'Teacher',
  'Payment', 'FeeStructure', 'Message', 'TimetableSlot',
  'TeacherContract', 'TeacherPayment', 'TeacherAttendance',
]);

/** Interface minimale pour éviter une dépendance circulaire avec CouchDbService */
export interface ICouchDbWriter {
  writeDocument(entityType: string, doc: any): Promise<{ id: string; rev: string }>;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private couchDbWriter: ICouchDbWriter | null = null;

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Injecte le writer CouchDB après la construction (évite la dépendance circulaire).
   * Appelé par SyncModule.onModuleInit().
   */
  setCouchDbWriter(writer: ICouchDbWriter): void {
    this.couchDbWriter = writer;
    this.logger.log('CouchDB writer connecté — propagation Postgres→CouchDB active');
  }

  /**
   * Propage une écriture PostgreSQL vers CouchDB (rupture #5 fix).
   *
   * Prisma v7 a supprimé $use(). Les services métier doivent appeler cette méthode
   * après leurs create/update/upsert pour propager vers CouchDB.
   *
   * Usage dans un service :
   *   const student = await this.prisma.student.create({ data: dto })
   *   this.prisma.notifyWrite('Student', student)  // ← ajouter cette ligne
   */
  notifyWrite(model: string, doc: any): void {
    if (!this.couchDbWriter || !SYNCABLE_MODELS.has(model)) return;
    if (!doc?.id || !doc?.tenantId) return;

    // Aplatir les relations imbriquées (user, classes, subjects, etc.)
    // pour que le client PouchDB puisse accéder aux détails directement.
    const flat: Record<string, unknown> = { ...doc };

    // User imbriqué → props user_ à la racine (firstName, email, etc.)
    const userObj = flat.user as Record<string, any> | undefined;
    if (userObj && typeof userObj === 'object') {
      for (const [k, v] of Object.entries(userObj)) {
        if (k !== 'phones') {
          flat[`user_${k}`] = v;
        }
      }
      // user.phones → user_phone_0_value, user_phone_1_value, etc.
      if (Array.isArray(userObj.phones)) {
        userObj.phones.forEach((p: any, i: number) => {
          flat[`user_phone_${i}`] = p.value;
        });
      }
      // Conserver user.id = userId (string) mais sans écraser les détails
      flat.user = { id: userObj.id || flat.userId };
    }

    // classes/subjects imbriqués → props class_X, subject_X
    if (Array.isArray(flat.classes)) {
      flat.classes.forEach((c: any, i: number) => {
        flat[`class_${i}_id`] = c.id;
        flat[`class_${i}_name`] = c.name;
      });
    }
    if (Array.isArray(flat.subjects)) {
      flat.subjects.forEach((s: any, i: number) => {
        flat[`subject_${i}_id`] = s.id;
        flat[`subject_${i}_name`] = s.name;
        flat[`subject_${i}_code`] = s.code;
      });
    }

    const couchDoc = {
      _id: flat.id,
      ...flat,
      ...(flat.deletedAt != null ? { _deleted: true } : {}),
    };

    // Fire-and-forget : ne pas bloquer la réponse API
    this.couchDbWriter
      .writeDocument(model, couchDoc)
      .catch((err: Error) =>
        this.logger.warn(`[notifyWrite] CouchDB write failed for ${model}/${doc.id}: ${err.message}`)
      );
  }
}
