import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CouchDbService } from '../couchdb/couchdb.service';
import { SyncService } from './sync.service';

describe('SyncService', () => {
  let service: SyncService;

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
  const mockCouchDb = {
    onChanges: jest.fn(),
    startAllChangeFeeds: jest.fn(),
    isConnected: jest.fn().mockResolvedValue(true),
    writeDocument: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: CouchDbService, useValue: mockCouchDb },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
    jest.clearAllMocks();
  });

  describe('resolveConflict', () => {
    const tenantId = 'tenant-1';
    const userId = 'user-1';

    it('devrait résoudre un conflit avec la stratégie USE_SERVER', async () => {
      mockPrisma.syncLog.findFirst.mockResolvedValue({
        id: 'conflict-1', tenantId, status: 'CONFLICT',
        serverVersion: 2, entityType: 'Student', entityId: 'stu-1',
        conflictData: { type: 'CRITICAL_FIELD_CONFLICT' },
      });
      mockPrisma.syncLog.update.mockResolvedValue({});

      const result = await service.resolveConflict(tenantId, 'conflict-1', { resolution: 'USE_SERVER' }, userId);
      expect(result).toEqual({ message: 'Conflict resolved', conflictId: 'conflict-1' });
    });

    it('devrait résoudre un conflit avec la stratégie USE_CLIENT', async () => {
      mockPrisma.syncLog.findFirst.mockResolvedValue({
        id: 'conflict-1', tenantId, status: 'CONFLICT',
        serverVersion: 2, entityType: 'Student', entityId: 'stu-1',
        payload: { firstName: 'Nouveau' },
      });
      mockPrisma.syncLog.update.mockResolvedValue({});
      mockPrisma.student.update.mockResolvedValue({});

      const result = await service.resolveConflict(
        tenantId, 'conflict-1',
        { resolution: 'USE_CLIENT', payload: { firstName: 'Nouveau' } }, userId,
      );
      expect(result).toEqual({ message: 'Conflict resolved', conflictId: 'conflict-1' });
      expect(mockPrisma.student.update).toHaveBeenCalled();
    });

    it('devrait lever BadRequestException si le conflit n\'existe pas', async () => {
      mockPrisma.syncLog.findFirst.mockResolvedValue(null);
      await expect(
        service.resolveConflict(tenantId, 'invalid', { resolution: 'USE_SERVER' }, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('registerDevice', () => {
    it('devrait créer un nouvel appareil', async () => {
      mockPrisma.syncDevice.upsert.mockResolvedValue({
        id: 'device-1', tenantId: 'tenant-1', deviceId: 'device-abc', deviceName: 'PC Bureau',
      });
      const result = await service.registerDevice('tenant-1', 'device-abc', 'PC Bureau', 'user-1');
      expect(result).toHaveProperty('deviceId', 'device-abc');
      expect(mockAudit.log).toHaveBeenCalled();
    });
  });

  describe('handleCouchDbChange', () => {
    it('devrait traiter un changement CREATE', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null);
      mockPrisma.student.create.mockResolvedValue({ id: 'stu-1' });

      await service.handleCouchDbChange({
        entityType: 'Student',
        operation: 'CREATE',
        docId: 'stu-1',
        doc: { _id: 'stu-1', firstName: 'Jean', lastName: 'Dupont', tenantId: 'tenant-1' },
        seq: 1,
      });

      expect(mockPrisma.student.create).toHaveBeenCalled();
    });

    it('devrait traiter un changement UPDATE', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({ id: 'stu-1', firstName: 'Ancien', tenantId: 'tenant-1' });
      mockPrisma.student.update.mockResolvedValue({ id: 'stu-1', firstName: 'Jean' });

      await service.handleCouchDbChange({
        entityType: 'Student',
        operation: 'UPDATE',
        docId: 'stu-1',
        doc: { _id: 'stu-1', firstName: 'Jean', lastName: 'Dupont', tenantId: 'tenant-1' },
        seq: 2,
      });

      expect(mockPrisma.student.update).toHaveBeenCalled();
    });
  });
});
