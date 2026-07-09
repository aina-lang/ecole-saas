import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SyncService } from './sync.service';
import { SyncOperation } from './dto/sync-batch.dto';

describe('SyncService', () => {
  let service: SyncService;
  let prisma: any;
  let audit: any;

  const mockPrisma = {
    syncLog: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    syncDevice: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    student: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    grade: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    attendance: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    class: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    subject: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockAudit = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
    prisma = module.get(PrismaService);
    audit = module.get(AuditService);

    jest.clearAllMocks();

    mockPrisma.syncDevice.upsert.mockResolvedValue({ id: 'device-1' });
    mockPrisma.syncDevice.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.syncLog.findMany.mockResolvedValue([]);
  });

  describe('processBatch', () => {
    const tenantId = 'tenant-1';
    const userId = 'user-1';

    it('devrait retourner un résultat vide pour un lot vide', async () => {
      const result = await service.processBatch(tenantId, userId, {
        deviceId: 'device-1',
        deviceName: 'Test Device',
        entries: [],
      });

      expect(result.results).toEqual([]);
      expect(result.changes).toEqual([]);
      expect(result).toHaveProperty('serverTimestamp');
    });

    it('devrait traiter une entrée CREATE avec succès et créer un mapping', async () => {
      const createdStudent = { id: 'server-id-1', registrationNumber: 'STU-001', firstName: 'Jean', tenantId };
      mockPrisma.syncLog.findFirst.mockResolvedValue(null);
      mockPrisma.student.create.mockResolvedValue(createdStudent);
      mockPrisma.syncLog.create.mockResolvedValue({});

      const result = await service.processBatch(tenantId, userId, {
        deviceId: 'device-1',
        deviceName: 'Test Device',
        entries: [
          {
            localId: 'local-1',
            entityType: 'Student',
            entityId: '',
            operation: SyncOperation.CREATE,
            payload: { registrationNumber: 'STU-001', firstName: 'Jean', lastName: 'Dupont' },
            version: 1,
            deviceId: 'device-1',
          },
        ],
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].localId).toBe('local-1');
      expect(result.results[0].status).toBe('SYNCED');
      expect(result.results[0].serverId).toBe('server-id-1');
      expect(mockPrisma.syncLog.create).toHaveBeenCalledTimes(2);
    });

    it('devrait traiter une entrée UPDATE avec une version correspondante', async () => {
      mockPrisma.syncLog.findFirst.mockResolvedValue({ serverVersion: 1, createdAt: new Date() });
      mockPrisma.student.findFirst.mockResolvedValue({ id: 'stu-1', firstName: 'Jean', tenantId });
      mockPrisma.student.update.mockResolvedValue({ id: 'stu-1' });
      mockPrisma.syncLog.create.mockResolvedValue({});

      const result = await service.processBatch(tenantId, userId, {
        deviceId: 'device-1',
        deviceName: 'Test Device',
        entries: [
          {
            localId: 'local-1',
            entityType: 'Student',
            entityId: 'stu-1',
            operation: SyncOperation.UPDATE,
            payload: { firstName: 'Pierre' },
            version: 1,
            deviceId: 'device-1',
          },
        ],
      });

      expect(result.results[0].status).toBe('SYNCED');
    });

    it('devrait créer un conflit pour UPDATE avec version conflictuelle', async () => {
      mockPrisma.syncLog.findFirst.mockResolvedValue({ serverVersion: 3, createdAt: new Date() });

      const result = await service.processBatch(tenantId, userId, {
        deviceId: 'device-1',
        deviceName: 'Test Device',
        entries: [
          {
            localId: 'local-1',
            entityType: 'Student',
            entityId: 'stu-1',
            operation: SyncOperation.UPDATE,
            payload: { firstName: 'Pierre' },
            version: 1,
            deviceId: 'device-1',
          },
        ],
      });

      expect(result.results[0].status).toBe('CONFLICT');
    });

    it('devrait détecter un conflit de champ critique (Grade.value)', async () => {
      mockPrisma.syncLog.findFirst.mockResolvedValue({ serverVersion: 2, createdAt: new Date() });
      mockPrisma.grade.findFirst.mockResolvedValue({ id: 'grade-1', value: 18, maxValue: 20, coefficient: 2, tenantId });

      const result = await service.processBatch(tenantId, userId, {
        deviceId: 'device-1',
        deviceName: 'Test Device',
        entries: [
          {
            localId: 'local-1',
            entityType: 'Grade',
            entityId: 'grade-1',
            operation: SyncOperation.UPDATE,
            payload: { value: 15 },
            version: 1,
            deviceId: 'device-1',
          },
        ],
      });

      expect(result.results[0].status).toBe('CONFLICT');
      expect(result.results[0].conflictData.type).toBe('CRITICAL_FIELD_CONFLICT');
      expect(result.results[0].conflictData.criticalFields).toContain('value');
    });
  });

  describe('getChangesSince', () => {
    it('devrait retourner les changements des autres appareils', async () => {
      const now = new Date();
      mockPrisma.syncLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          entityType: 'Student',
          entityId: 'stu-1',
          operation: 'UPDATE',
          payload: { firstName: 'Pierre' },
          status: 'SYNCED',
          serverVersion: 2,
          deviceId: 'other-device',
          createdAt: now,
        },
      ]);
      mockPrisma.student.findMany.mockResolvedValue([
        { id: 'stu-1', firstName: 'Pierre', lastName: 'Dupont', tenantId: 'tenant-1' },
      ]);

      const changes = await service.getChangesSince('tenant-1', 'my-device', new Date(Date.now() - 3600000).toISOString());

      expect(changes).toHaveLength(1);
      expect(changes[0].entityId).toBe('stu-1');
      expect(changes[0].operation).toBe('UPDATE');
      expect(changes[0].deviceId).toBe('other-device');
    });

    it('devrait retourner un tableau vide si aucun changement', async () => {
      mockPrisma.syncLog.findMany.mockResolvedValue([]);
      const changes = await service.getChangesSince('tenant-1', 'my-device');
      expect(changes).toEqual([]);
    });
  });

  describe('resolveConflict', () => {
    const tenantId = 'tenant-1';
    const userId = 'user-1';

    it('devrait résoudre un conflit avec la stratégie USE_SERVER', async () => {
      mockPrisma.syncLog.findFirst.mockResolvedValue({
        id: 'conflict-1',
        tenantId,
        status: 'CONFLICT',
        serverVersion: 2,
        entityType: 'Student',
        entityId: 'stu-1',
        conflictData: { type: 'CRITICAL_FIELD_CONFLICT' },
      });
      mockPrisma.syncLog.update.mockResolvedValue({});

      const result = await service.resolveConflict(tenantId, 'conflict-1', { resolution: 'USE_SERVER' }, userId);

      expect(result).toEqual({ message: 'Conflict resolved', conflictId: 'conflict-1' });
      expect(mockPrisma.syncLog.update).toHaveBeenCalled();
    });

    it('devrait résoudre un conflit avec la stratégie USE_CLIENT', async () => {
      mockPrisma.syncLog.findFirst.mockResolvedValue({
        id: 'conflict-1',
        tenantId,
        status: 'CONFLICT',
        serverVersion: 2,
        entityType: 'Student',
        entityId: 'stu-1',
        payload: { firstName: 'Nouveau' },
      });
      mockPrisma.syncLog.update.mockResolvedValue({});
      mockPrisma.student.update.mockResolvedValue({});

      const result = await service.resolveConflict(
        tenantId,
        'conflict-1',
        { resolution: 'USE_CLIENT', payload: { firstName: 'Nouveau' } },
        userId,
      );

      expect(result).toEqual({ message: 'Conflict resolved', conflictId: 'conflict-1' });
      expect(mockPrisma.student.update).toHaveBeenCalled();
    });

    it('devrait résoudre un conflit avec la stratégie USE_MERGE', async () => {
      mockPrisma.syncLog.findFirst.mockResolvedValue({
        id: 'conflict-1',
        tenantId,
        status: 'CONFLICT',
        serverVersion: 2,
        entityType: 'Student',
        entityId: 'stu-1',
      });
      mockPrisma.syncLog.update.mockResolvedValue({});
      mockPrisma.student.update.mockResolvedValue({});

      const result = await service.resolveConflict(
        tenantId,
        'conflict-1',
        { resolution: 'USE_MERGE', mergedPayload: { firstName: 'Merge', lastName: 'Result' } },
        userId,
      );

      expect(result).toEqual({ message: 'Conflict resolved', conflictId: 'conflict-1' });
      expect(mockPrisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { firstName: 'Merge', lastName: 'Result' } }),
      );
    });

    it('devrait lever BadRequestException si le conflit n\'existe pas', async () => {
      mockPrisma.syncLog.findFirst.mockResolvedValue(null);
      await expect(
        service.resolveConflict(tenantId, 'invalid', { resolution: 'USE_SERVER' }, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('devrait lever BadRequestException si mergedPayload manque pour USE_MERGE', async () => {
      mockPrisma.syncLog.findFirst.mockResolvedValue({
        id: 'conflict-1',
        tenantId,
        status: 'CONFLICT',
        entityType: 'Student',
        entityId: 'stu-1',
      });
      await expect(
        service.resolveConflict(tenantId, 'conflict-1', { resolution: 'USE_MERGE' }, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('registerDevice', () => {
    it('devrait créer un nouvel appareil', async () => {
      mockPrisma.syncDevice.upsert.mockResolvedValue({
        id: 'device-1',
        tenantId: 'tenant-1',
        deviceId: 'device-abc',
        deviceName: 'PC Bureau',
      });

      const result = await service.registerDevice('tenant-1', 'device-abc', 'PC Bureau', 'user-1');

      expect(result).toHaveProperty('deviceId', 'device-abc');
      expect(mockPrisma.syncDevice.upsert).toHaveBeenCalledWith({
        where: { tenantId_deviceId: { tenantId: 'tenant-1', deviceId: 'device-abc' } },
        update: { deviceName: 'PC Bureau', lastSyncAt: expect.any(Date) },
        create: { tenantId: 'tenant-1', deviceId: 'device-abc', deviceName: 'PC Bureau' },
      });
      expect(mockAudit.log).toHaveBeenCalled();
    });

    it('devrait mettre à jour un appareil existant', async () => {
      mockPrisma.syncDevice.upsert.mockResolvedValue({
        id: 'device-1',
        tenantId: 'tenant-1',
        deviceId: 'device-abc',
        deviceName: 'Nouveau Nom',
      });

      const result = await service.registerDevice('tenant-1', 'device-abc', 'Nouveau Nom', 'user-1');

      expect(result.deviceName).toBe('Nouveau Nom');
    });
  });
});
