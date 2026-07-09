import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const SYNC_QUEUE = 'sync';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

@Injectable()
@Processor(SYNC_QUEUE)
export class SyncProcessor {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  @Process('process-sync-job')
  async handleSyncJob(job: Job<{ tenantId: string; jobId: string }>) {
    const { tenantId, jobId } = job.data;

    try {
      const syncJob = await this.prisma.syncJob.findUnique({ where: { id: jobId } });
      if (!syncJob || syncJob.status === 'COMPLETED') {
        return { skipped: true };
      }

      this.logger.log(`Processing sync job ${jobId} (${syncJob.jobType})`);

      switch (syncJob.jobType) {
        case 'PROCESS_BATCH':
          await this.processBatchJob(syncJob, tenantId);
          break;
        case 'RESOLVE_CONFLICT':
          await this.resolveConflictJob(syncJob, tenantId);
          break;
        case 'PUSH_CHANGES':
          await this.pushChangesJob(syncJob, tenantId);
          break;
        default:
          this.logger.warn(`Unknown job type: ${syncJob.jobType}`);
          await this.prisma.syncJob.update({
            where: { id: jobId },
            data: { status: 'ERROR', error: `Unknown job type: ${syncJob.jobType}` },
          });
          return { error: 'Unknown job type' };
      }

      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', processedAt: new Date() },
      });

      return { success: true, jobType: syncJob.jobType };
    } catch (error) {
      const attempts = (job.attemptsDone || 0) + 1;
      this.logger.error(`Sync job ${jobId} failed (attempt ${attempts}): ${error.message}`);

      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: { error: error.message, status: attempts >= MAX_RETRIES ? 'ERROR' : 'PENDING' },
      });

      await this.audit.log({
        tenantId,
        action: 'SYNC_JOB_FAILED',
        entityType: 'SyncJob',
        entityId: jobId,
        metadata: { error: error.message, attempts },
      });

      if (attempts < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempts - 1);
        throw error;
      }

      return { success: false, error: error.message };
    }
  }

  private async processBatchJob(syncJob: any, tenantId: string) {
    const payload = syncJob.payload as any;
    this.logger.log(`Processing batch with ${payload.entryCount || 0} entries for tenant ${tenantId}`);
  }

  private async resolveConflictJob(syncJob: any, tenantId: string) {
    const payload = syncJob.payload as any;
    this.logger.log(`Resolving conflict ${payload.conflictId} for tenant ${tenantId}`);
  }

  private async pushChangesJob(syncJob: any, tenantId: string) {
    const payload = syncJob.payload as any;
    this.logger.log(`Pushing changes to device ${payload.deviceId} for tenant ${tenantId}`);
  }
}