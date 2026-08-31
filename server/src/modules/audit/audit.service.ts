import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';

// Rétention des journaux : sans purge, audit_logs croît plus vite que les
// données métier (chaque écriture client y logue les documents complets
// avant/après) et sync_logs accumule les rejets traités.
const AUDIT_LOG_RETENTION_DAYS = 180;
const SYNC_LOG_RETENTION_DAYS = 90;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Purge quotidienne. Limite connue : les documents AuditLog déjà répliqués
   * dans CouchDB/PouchDB ne sont pas purgés ici — seule la base serveur est
   * bornée (c'est elle qui porte l'historique long terme et la volumétrie).
   * Les conflits SyncLog non résolus (status CONFLICT) sont conservés.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeOldLogs() {
    const cutoff = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    try {
      const audit = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff(AUDIT_LOG_RETENTION_DAYS) } },
      });
      const sync = await this.prisma.syncLog.deleteMany({
        where: {
          createdAt: { lt: cutoff(SYNC_LOG_RETENTION_DAYS) },
          status: { not: 'CONFLICT' },
        },
      });
      if (audit.count || sync.count) {
        this.logger.log(`Purge des journaux : ${audit.count} audit_logs, ${sync.count} sync_logs supprimés`);
      }
    } catch (err: any) {
      this.logger.error(`Purge des journaux échouée: ${err.message}`);
    }
  }

  async log(params: {
    tenantId: string;
    userId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const log = await this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValue: params.oldValue || undefined,
        newValue: params.newValue || undefined,
        metadata: params.metadata || undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
    // Propage vers CouchDB pour que les clients PouchDB voient aussi les actions
    // effectuées côté serveur (pas seulement leurs propres logs générés offline).
    this.prisma.notifyWrite('AuditLog', log);
    return log;
  }

  async findByTenant(tenantId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where: { tenantId } }),
    ]);
    return { data, total, page, limit };
  }
}
