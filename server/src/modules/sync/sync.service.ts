import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SyncBatchDto, SyncEntryDto, SyncResultDto, SyncResultEntry, SyncChange, ResolveConflictDto, SyncOperation } from './dto/sync-batch.dto';

const CRITICAL_FIELDS: Record<string, string[]> = {
  Grade: ['value', 'maxValue', 'coefficient'],
  Attendance: ['status'],
  Payment: ['amount', 'status'],
  Invoice: ['totalAmount', 'paidAmount', 'status'],
};

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async processBatch(tenantId: string, userId: string, dto: SyncBatchDto): Promise<SyncResultDto> {
    await this.upsertDevice(tenantId, dto.deviceId, dto.deviceName);

    const results: SyncResultEntry[] = [];

    for (const entry of dto.entries) {
      try {
        const result = await this.processEntry(tenantId, userId, entry, dto.deviceId);
        results.push(result);
      } catch (error) {
        this.logger.error(`Error processing entry ${entry.localId}: ${error.message}`);
        results.push({
          localId: entry.localId,
          serverId: null,
          serverVersion: null,
          status: 'ERROR',
          errorMessage: error.message,
        });
      }
    }

    const changes = await this.getChangesSince(tenantId, dto.deviceId, dto.lastSyncTimestamp);

    await this.prisma.syncDevice.updateMany({
      where: { tenantId, deviceId: dto.deviceId },
      data: { lastSyncAt: new Date(), lastSyncTimestamp: new Date().toISOString() },
    });

    return {
      results,
      changes,
      serverTimestamp: new Date().toISOString(),
    };
  }

  private async processEntry(
    tenantId: string,
    userId: string,
    entry: SyncEntryDto,
    deviceId: string,
  ): Promise<SyncResultEntry> {
    switch (entry.operation) {
      case 'CREATE':
        return this.handleCreate(tenantId, userId, entry);
      case 'UPDATE':
        return this.handleUpdate(tenantId, userId, entry);
      case 'DELETE':
        return this.handleDelete(tenantId, userId, entry);
      default:
        throw new BadRequestException(`Unknown operation: ${entry.operation}`);
    }
  }

  private async handleCreate(
    tenantId: string,
    userId: string,
    entry: SyncEntryDto,
  ): Promise<SyncResultEntry> {
    const entityType = entry.entityType;
    const localId = entry.localId;

    const existingMapping = await this.prisma.syncLog.findFirst({
      where: { tenantId, entityType, entityId: entityType === 'Student' ? entry.payload?.registrationNumber : localId },
    });

    if (existingMapping) {
      const existingRecord = await this.getEntityById(tenantId, entityType, existingMapping.entityId);
      if (existingRecord) {
        return {
          localId,
          serverId: existingMapping.entityId,
          serverVersion: existingMapping.serverVersion ?? 1,
          status: 'SYNCED',
        };
      }
    }

    const createData = { ...entry.payload };
    delete createData.id;
    delete createData.localId;

    let entity: any;
    try {
      entity = await this.createEntity(tenantId, userId, entityType, createData);
    } catch (error) {
      return {
        localId,
        serverId: null,
        serverVersion: null,
        status: 'ERROR',
        errorMessage: `Failed to create ${entityType}: ${error.message}`,
      };
    }

    await this.prisma.syncLog.create({
      data: {
        tenantId,
        deviceId: entry.deviceId,
        entityType,
        entityId: entity.id,
        operation: 'CREATE',
        payload: entry.payload,
        status: 'SYNCED',
        serverVersion: 1,
      },
    });

    if (localId !== entity.id) {
      await this.prisma.syncLog.create({
        data: {
          tenantId,
          deviceId: entry.deviceId,
          entityType: `${entityType}_ID_MAP`,
          entityId: localId,
          operation: 'CREATE',
          payload: { localId, serverId: entity.id },
          status: 'SYNCED',
        },
      });
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'SYNC_CREATE',
      entityType,
      entityId: entity.id,
      metadata: { localId, deviceId: entry.deviceId },
      newValue: entry.payload,
    });

    return {
      localId,
      serverId: entity.id,
      serverVersion: 1,
      status: 'SYNCED',
    };
  }

  private async handleUpdate(
    tenantId: string,
    userId: string,
    entry: SyncEntryDto,
  ): Promise<SyncResultEntry> {
    const entityType = entry.entityType;
    const serverId = entry.entityId;

    const existingLog = await this.prisma.syncLog.findFirst({
      where: { tenantId, entityType, entityId: serverId, operation: 'UPDATE' },
      orderBy: { createdAt: 'desc' },
    });

    const currentVersion = existingLog?.serverVersion ?? 0;

    if (entry.version > 0 && entry.version < currentVersion) {
      const conflict = await this.detectConflict(tenantId, entityType, serverId, entry);
      if (conflict) {
        await this.markConflict(tenantId, entry.deviceId, entityType, serverId, entry, currentVersion, conflict);
        return {
          localId: entry.localId,
          serverId,
          serverVersion: currentVersion,
          status: 'CONFLICT',
          conflictData: conflict,
        };
      }
    }

    const criticalFields = CRITICAL_FIELDS[entityType] || [];
    const hasCriticalChanges = criticalFields.some((field) => field in (entry.payload || {}));

    if (hasCriticalChanges && currentVersion > 0 && entry.version !== currentVersion) {
      const serverEntity = await this.getEntityById(tenantId, entityType, serverId);
      if (serverEntity) {
        const conflict = {
          type: 'CRITICAL_FIELD_CONFLICT',
          message: `Version mismatch on critical fields for ${entityType}`,
          clientVersion: entry.version,
          serverVersion: currentVersion,
          clientPayload: entry.payload,
          serverPayload: this.extractCriticalFields(serverEntity, entityType),
          criticalFields: criticalFields.filter((f) => f in (entry.payload || {})),
        };

        await this.markConflict(tenantId, entry.deviceId, entityType, serverId, entry, currentVersion, conflict);
        return {
          localId: entry.localId,
          serverId,
          serverVersion: currentVersion,
          status: 'CONFLICT',
          conflictData: conflict,
        };
      }
    }

    try {
      const updateData = { ...entry.payload };
      delete updateData.id;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      await this.updateEntity(tenantId, entityType, serverId, updateData);
      const newVersion = currentVersion + 1;

      await this.prisma.syncLog.create({
        data: {
          tenantId,
          deviceId: entry.deviceId,
          entityType,
          entityId: serverId,
          operation: 'UPDATE',
          payload: entry.payload,
          status: 'SYNCED',
          serverVersion: newVersion,
        },
      });

      await this.audit.log({
        tenantId,
        userId,
        action: 'SYNC_UPDATE',
        entityType,
        entityId: serverId,
        metadata: { localId: entry.localId, deviceId: entry.deviceId, previousVersion: currentVersion },
        oldValue: { version: currentVersion },
        newValue: { version: newVersion, ...updateData },
      });

      return {
        localId: entry.localId,
        serverId,
        serverVersion: newVersion,
        status: 'SYNCED',
      };
    } catch (error) {
      return {
        localId: entry.localId,
        serverId,
        serverVersion: currentVersion,
        status: 'ERROR',
        errorMessage: `Failed to update ${entityType}: ${error.message}`,
      };
    }
  }

  private async handleDelete(
    tenantId: string,
    userId: string,
    entry: SyncEntryDto,
  ): Promise<SyncResultEntry> {
    const serverId = entry.entityId;
    const entityType = entry.entityType;

    const entity = await this.getEntityById(tenantId, entityType, serverId);
    if (!entity) {
      return {
        localId: entry.localId,
        serverId,
        serverVersion: null,
        status: 'SYNCED',
      };
    }

    try {
      await this.softDeleteEntity(tenantId, entityType, serverId);

      await this.prisma.syncLog.create({
        data: {
          tenantId,
          deviceId: entry.deviceId,
          entityType,
          entityId: serverId,
          operation: 'DELETE',
          payload: entry.payload,
          status: 'SYNCED',
        },
      });

      await this.audit.log({
        tenantId,
        userId,
        action: 'SYNC_DELETE',
        entityType,
        entityId: serverId,
        metadata: { localId: entry.localId, deviceId: entry.deviceId },
      });

      return {
        localId: entry.localId,
        serverId,
        serverVersion: null,
        status: 'SYNCED',
      };
    } catch (error) {
      return {
        localId: entry.localId,
        serverId,
        serverVersion: null,
        status: 'ERROR',
        errorMessage: `Failed to delete ${entityType}: ${error.message}`,
      };
    }
  }

  private async detectConflict(
    tenantId: string,
    entityType: string,
    entityId: string,
    entry: SyncEntryDto,
  ): Promise<any> {
    const criticalFields = CRITICAL_FIELDS[entityType] || [];
    const hasCritical = criticalFields.some((f) => f in (entry.payload || {}));
    if (!hasCritical) return null;

    const serverData = await this.getEntityById(tenantId, entityType, entityId);
    if (!serverData) return null;

    const criticalConflicts: string[] = [];
    for (const field of criticalFields) {
      if (field in entry.payload && JSON.stringify(entry.payload[field]) !== JSON.stringify((serverData as any)[field])) {
        criticalConflicts.push(field);
      }
    }

    if (criticalConflicts.length === 0) return null;

    return {
      type: 'CRITICAL_FIELD_CONFLICT',
      criticalFields: criticalConflicts,
      clientValues: criticalConflicts.reduce((acc, f) => ({ ...acc, [f]: entry.payload[f] }), {}),
      serverValues: criticalConflicts.reduce((acc, f) => ({ ...acc, [f]: (serverData as any)[f] }), {}),
      clientVersion: entry.version,
      entityType,
    };
  }

  private async markConflict(
    tenantId: string,
    deviceId: string,
    entityType: string,
    entityId: string,
    entry: SyncEntryDto,
    serverVersion: number,
    conflictData: any,
  ) {
    await this.prisma.syncLog.create({
      data: {
        tenantId,
        deviceId,
        entityType,
        entityId,
        operation: 'UPDATE',
        payload: entry.payload,
        status: 'CONFLICT',
        serverVersion,
        conflictData,
      },
    });
  }

  async getChangesSince(
    tenantId: string,
    requestingDeviceId: string,
    lastSyncTimestamp?: string,
  ): Promise<SyncChange[]> {
    const where: any = {
      tenantId,
      deviceId: { not: requestingDeviceId },
      status: 'SYNCED',
    };

    if (lastSyncTimestamp) {
      where.createdAt = { gt: new Date(lastSyncTimestamp) };
    }

    const logs = await this.prisma.syncLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    const entityIdsByType = new Map<string, Set<string>>();
    for (const log of logs) {
      if (!entityIdsByType.has(log.entityType)) {
        entityIdsByType.set(log.entityType, new Set());
      }
      entityIdsByType.get(log.entityType)!.add(log.entityId);
    }

    const serverDataCache = new Map<string, Map<string, any>>();
    for (const [entityType, ids] of entityIdsByType) {
      if (entityType.endsWith('_Local_MAP')) continue;
      try {
        const entities = await this.getEntitiesByIds(tenantId, entityType, Array.from(ids));
        const map = new Map<string, any>();
        for (const e of entities) {
          map.set(e.id, e);
        }
        serverDataCache.set(entityType, map);
      } catch {
        serverDataCache.set(entityType, new Map());
      }
    }

    const changeMap = new Map<string, SyncChange>();
    for (const log of logs) {
      if (log.entityType.endsWith('_Local_MAP')) continue;

      const key = `${log.entityType}:${log.entityId}`;
      const cache = serverDataCache.get(log.entityType);
      const currentData = cache?.get(log.entityId);

      const payload = log.operation === 'DELETE'
        ? log.payload as Record<string, any>
        : (currentData || log.payload) as Record<string, any>;

      changeMap.set(key, {
        entityType: log.entityType,
        entityId: log.entityId,
        operation: log.operation as SyncOperation,
        payload,
        serverVersion: log.serverVersion ?? 1,
        deviceId: log.deviceId,
        updatedAt: log.createdAt.toISOString(),
      });
    }

    return Array.from(changeMap.values());
  }

  async registerDevice(tenantId: string, deviceId: string, deviceName: string, userId?: string) {
    const device = await this.prisma.syncDevice.upsert({
      where: { tenantId_deviceId: { tenantId, deviceId } },
      update: { deviceName, lastSyncAt: new Date() },
      create: { tenantId, deviceId, deviceName },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'REGISTER_DEVICE',
      entityType: 'SyncDevice',
      entityId: device.id,
      newValue: { deviceId, deviceName },
    });

    return device;
  }

  private async upsertDevice(tenantId: string, deviceId: string, deviceName: string) {
    return this.prisma.syncDevice.upsert({
      where: { tenantId_deviceId: { tenantId, deviceId } },
      update: { deviceName, lastSyncAt: new Date() },
      create: { tenantId, deviceId, deviceName },
    });
  }

  async resolveConflict(
    tenantId: string,
    conflictId: string,
    resolution: ResolveConflictDto,
    userId: string,
  ) {
    const syncLog = await this.prisma.syncLog.findFirst({
      where: { id: conflictId, tenantId, status: 'CONFLICT' },
    });

    if (!syncLog) {
      throw new BadRequestException('Conflict not found or already resolved');
    }

    if (resolution.resolution === 'USE_SERVER') {
      await this.prisma.syncLog.update({
        where: { id: conflictId },
        data: {
          status: 'SYNCED',
          conflictData: Prisma.DbNull,
        },
      });
    } else if (resolution.resolution === 'USE_CLIENT') {
      const entityType = syncLog.entityType;
      const entityId = syncLog.entityId;
      const payload = resolution.payload || (syncLog.payload as Record<string, any>);

      await this.updateEntity(tenantId, entityType, entityId, payload);

      await this.prisma.syncLog.update({
        where: { id: conflictId },
        data: {
          status: 'SYNCED',
          conflictData: Prisma.DbNull,
          serverVersion: (syncLog.serverVersion ?? 0) + 1,
        },
      });
    } else if (resolution.resolution === 'USE_MERGE') {
      if (!resolution.mergedPayload) {
        throw new BadRequestException('mergedPayload required for USE_MERGE resolution');
      }

      const entityType = syncLog.entityType;
      const entityId = syncLog.entityId;

      await this.updateEntity(tenantId, entityType, entityId, resolution.mergedPayload);

      await this.prisma.syncLog.update({
        where: { id: conflictId },
        data: {
          status: 'SYNCED',
          conflictData: Prisma.DbNull,
          serverVersion: (syncLog.serverVersion ?? 0) + 1,
        },
      });
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'RESOLVE_CONFLICT',
      entityType: syncLog.entityType,
      entityId: syncLog.entityId,
      metadata: { conflictType: syncLog.entityType, conflictId, resolution: resolution.resolution },
      oldValue: syncLog.conflictData,
      newValue: resolution,
    });

    return { message: 'Conflict resolved', conflictId };
  }

  async listConflicts(tenantId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.syncLog.findMany({
        where: { tenantId, status: 'CONFLICT' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.syncLog.count({ where: { tenantId, status: 'CONFLICT' } }),
    ]);

    return { data, total, page, limit };
  }

  async getSyncStatus(tenantId: string) {
    const [devices, pendingJobs, unresolvedConflicts, recentSyncs] = await Promise.all([
      this.prisma.syncDevice.findMany({ where: { tenantId } }),
      this.prisma.syncLog.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.syncLog.count({ where: { tenantId, status: 'CONFLICT' } }),
      this.prisma.syncLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          operation: true,
          status: true,
          deviceId: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      deviceCount: devices.length,
      devices: devices.map((d) => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        lastSyncAt: d.lastSyncAt,
      })),
      pendingJobs,
      unresolvedConflicts,
      recentSyncs,
    };
  }

  async createEntity(tenantId: string, userId: string, entityType: string, data: any): Promise<any> {
    switch (entityType) {
      case 'Student':
        return this.prisma.student.create({ data: { ...data, tenantId } });
      case 'Grade':
        return this.prisma.grade.create({ data: { ...data, tenantId } });
      case 'Attendance':
        return this.prisma.attendance.create({ data: { ...data, tenantId } });
      case 'Class':
        return this.prisma.class.create({ data: { ...data, tenantId } });
      case 'Subject':
        return this.createSubjectByTenantId(tenantId, data);
      default:
        throw new BadRequestException(`Unsupported entity type for sync: ${entityType}`);
    }
  }

  async updateEntity(tenantId: string, entityType: string, id: string, data: any): Promise<any> {
    const where = { id };

    switch (entityType) {
      case 'Student':
        return this.prisma.student.update({ where, data });
      case 'Grade':
        return this.prisma.grade.update({ where, data });
      case 'Attendance':
        const attendance = await this.prisma.attendance.findFirst({ where: { id, tenantId, deletedAt: null } });
        if (attendance && new Date(attendance.date).getTime() < Date.now() - 24 * 60 * 60 * 1000) {
          throw new ForbiddenException('Cette présence ne peut plus être modifiée après 24h');
        }
        return this.prisma.attendance.update({ where, data });
      case 'Class':
        return this.prisma.class.update({ where, data });
      case 'Subject':
        return this.prisma.subject.update({ where, data });
      default:
        throw new BadRequestException(`Unsupported entity type for sync: ${entityType}`);
    }
  }

  async getEntityById(tenantId: string, entityType: string, id: string): Promise<any> {
    switch (entityType) {
      case 'Student':
        return this.prisma.student.findFirst({ where: { id, tenantId, deletedAt: null } });
      case 'Grade':
        return this.prisma.grade.findFirst({ where: { id, tenantId, deletedAt: null } });
      case 'Attendance':
        return this.prisma.attendance.findFirst({ where: { id, tenantId, deletedAt: null } });
      case 'Class':
        return this.prisma.class.findFirst({ where: { id, tenantId } });
      case 'Subject':
        return this.prisma.subject.findFirst({ where: { id, tenantId } });
      default:
        return null;
    }
  }

  async getEntitiesByIds(tenantId: string, entityType: string, ids: string[]): Promise<any[]> {
    switch (entityType) {
      case 'Student':
        return this.prisma.student.findMany({ where: { id: { in: ids }, tenantId, deletedAt: null } });
      case 'Grade':
        return this.prisma.grade.findMany({ where: { id: { in: ids }, tenantId, deletedAt: null } });
      case 'Attendance':
        return this.prisma.attendance.findMany({ where: { id: { in: ids }, tenantId, deletedAt: null } });
      case 'Class':
        return this.prisma.class.findMany({ where: { id: { in: ids }, tenantId } });
      case 'Subject':
        return this.prisma.subject.findMany({ where: { id: { in: ids }, tenantId } });
      default:
        return [];
    }
  }

  async softDeleteEntity(tenantId: string, entityType: string, id: string): Promise<void> {
    switch (entityType) {
      case 'Student':
        await this.prisma.student.update({ where: { id }, data: { deletedAt: new Date() } });
        break;
      case 'Grade':
        await this.prisma.grade.update({ where: { id }, data: { deletedAt: new Date() } });
        break;
      case 'Attendance':
        const attendance = await this.prisma.attendance.findFirst({ where: { id, tenantId, deletedAt: null } });
        if (attendance && new Date(attendance.date).getTime() < Date.now() - 24 * 60 * 60 * 1000) {
          throw new ForbiddenException('Cette présence ne peut plus être modifiée après 24h');
        }
        await this.prisma.attendance.update({ where: { id }, data: { deletedAt: new Date() } });
        break;
      case 'Class':
      case 'Subject':
        break;
      default:
        throw new BadRequestException(`Unsupported entity type for deletion: ${entityType}`);
    }
  }

  private async createSubjectByTenantId(tenantId: string, data: any) {
    return this.prisma.subject.create({ data: { ...data, tenantId } });
  }

  private extractCriticalFields(entity: any, entityType: string): Record<string, any> {
    const fields = CRITICAL_FIELDS[entityType] || [];
    const result: Record<string, any> = {};
    for (const field of fields) {
      if (field in entity) {
        result[field] = entity[field];
      }
    }
    return result;
  }
}