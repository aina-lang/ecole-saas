import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CouchDbService } from '../couchdb/couchdb.service';
import { ResolveConflictDto } from './dto/sync-batch.dto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private couchdb: CouchDbService,
  ) {}

  async writeServerMutationToCouchDB(tenantId: string, entityType: string, entityData: any, operation: 'CREATE' | 'UPDATE' | 'DELETE') {
    const doc = {
      _id: entityData.id,
      ...entityData,
      tenantId,
      updatedAt: new Date().toISOString(),
    };
    if (operation === 'DELETE') {
      doc._deleted = true;
    }
    await this.couchdb.writeDocument(entityType, doc);
  }

  async registerDevice(tenantId: string, deviceId: string, deviceName: string, userId?: string) {
    const device = await this.prisma.syncDevice.upsert({
      where: { deviceId },
      update: { tenantId, deviceName, lastSyncAt: new Date() },
      create: { tenantId, deviceId, deviceName },
    });
    await this.audit.log({
      tenantId, userId, action: 'REGISTER_DEVICE',
      entityType: 'SyncDevice', entityId: device.id,
      newValue: { deviceId, deviceName },
    });
    return device;
  }

  async resolveConflict(tenantId: string, conflictId: string, resolution: ResolveConflictDto, userId: string) {
    const syncLog = await this.prisma.syncLog.findFirst({
      where: { id: conflictId, tenantId, status: 'CONFLICT' },
    });
    if (!syncLog) throw new BadRequestException('Conflict not found or already resolved');

    if (resolution.resolution === 'USE_SERVER') {
      await this.prisma.syncLog.update({
        where: { id: conflictId },
        data: { status: 'SYNCED', conflictData: Prisma.DbNull },
      });
    } else if (resolution.resolution === 'USE_CLIENT') {
      const payload = resolution.payload || (syncLog.payload as Record<string, any>);
      await this.couchdb.writeDocument(syncLog.entityType, { _id: syncLog.entityId, ...payload });
      await this.prisma.syncLog.update({
        where: { id: conflictId },
        data: { status: 'SYNCED', conflictData: Prisma.DbNull, serverVersion: (syncLog.serverVersion ?? 0) + 1 },
      });
    } else if (resolution.resolution === 'USE_MERGE') {
      if (!resolution.mergedPayload) throw new BadRequestException('mergedPayload required for USE_MERGE');
      await this.couchdb.writeDocument(syncLog.entityType, { _id: syncLog.entityId, ...resolution.mergedPayload });
      await this.prisma.syncLog.update({
        where: { id: conflictId },
        data: { status: 'SYNCED', conflictData: Prisma.DbNull, serverVersion: (syncLog.serverVersion ?? 0) + 1 },
      });
    }

    await this.audit.log({
      tenantId, userId, action: 'RESOLVE_CONFLICT',
      entityType: syncLog.entityType, entityId: syncLog.entityId,
      metadata: { conflictId, resolution: resolution.resolution },
      oldValue: syncLog.conflictData, newValue: resolution,
    });
    return { message: 'Conflict resolved', conflictId };
  }

  async listConflicts(tenantId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.syncLog.findMany({
        where: { tenantId, status: 'CONFLICT' },
        orderBy: { createdAt: 'desc' }, skip, take: limit,
      }),
      this.prisma.syncLog.count({ where: { tenantId, status: 'CONFLICT' } }),
    ]);
    return { data, total, page, limit };
  }

  async getSyncStatus(tenantId: string) {
    const [devices, unresolvedConflicts, recentSyncs] = await Promise.all([
      this.prisma.syncDevice.findMany({ where: { tenantId } }),
      this.prisma.syncLog.count({ where: { tenantId, status: 'CONFLICT' } }),
      this.prisma.syncLog.findMany({
        where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 20,
        select: { id: true, entityType: true, entityId: true, operation: true, status: true, deviceId: true, createdAt: true },
      }),
    ]);
    const couchDbOk = await this.couchdb.isConnected();
    return {
      couchdb: couchDbOk ? 'connected' : 'disconnected',
      deviceCount: devices.length,
      devices: devices.map((d) => ({ deviceId: d.deviceId, deviceName: d.deviceName, lastSyncAt: d.lastSyncAt })),
      unresolvedConflicts, recentSyncs,
    };
  }
}
