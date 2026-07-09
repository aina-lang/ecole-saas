import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

@Injectable()
export class SyncProcessor {
  private readonly logger = new Logger(SyncProcessor.name);
  private processing = false;

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  @Interval(10000)
  async processPendingJobs() {
    if (this.processing) return;
    this.processing = true;

    try {
      const jobs = await this.prisma.syncJob.findMany({
        where: { status: 'PENDING' },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: 10,
      });

      for (const job of jobs) {
        await this.processJob(job);
      }
    } catch (error) {
      this.logger.error(`Error processing sync jobs: ${error.message}`);
    } finally {
      this.processing = false;
    }
  }

  private async processJob(job: any) {
    const { id, tenantId, jobType, payload } = job;

    try {
      this.logger.log(`Processing sync job ${id} (${jobType})`);

      switch (jobType) {
        case 'PROCESS_BATCH':
          break;
        case 'RESOLVE_CONFLICT':
          break;
        case 'PUSH_CHANGES':
          break;
        case 'FILE_UPLOAD':
          break;
        default:
          this.logger.warn(`Unknown job type: ${jobType}`);
          await this.prisma.syncJob.update({
            where: { id },
            data: { status: 'ERROR', error: `Unknown job type: ${jobType}` },
          });
          return;
      }

      await this.prisma.syncJob.update({
        where: { id },
        data: { status: 'COMPLETED', processedAt: new Date() },
      });
    } catch (error) {
      const job_ = await this.prisma.syncJob.findUnique({ where: { id } });
      const attempts = (job_?.retryCount || 0) + 1;
      this.logger.error(`Sync job ${id} failed (attempt ${attempts}): ${error.message}`);

      await this.prisma.syncJob.update({
        where: { id },
        data: {
          error: error.message,
          status: attempts >= MAX_RETRIES ? 'ERROR' : 'PENDING',
          retryCount: attempts,
        },
      });

      await this.audit.log({
        tenantId,
        action: 'SYNC_JOB_FAILED',
        entityType: 'SyncJob',
        entityId: id,
        metadata: { error: error.message, attempts },
      });
    }
  }

  async enqueueJob(params: {
    tenantId: string;
    jobType: string;
    payload: any;
    priority?: number;
  }) {
    return this.prisma.syncJob.create({
      data: {
        tenantId: params.tenantId,
        jobType: params.jobType,
        payload: params.payload,
        priority: params.priority || 0,
      },
    });
  }
}
