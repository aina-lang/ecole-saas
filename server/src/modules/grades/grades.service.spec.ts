import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GradesService } from './grades.service';

describe('GradesService', () => {
  let service: GradesService;
  let prisma: any;
  let audit: any;

  const mockPrisma = {
    grade: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    student: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockAudit = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<GradesService>(GradesService);
    prisma = module.get(PrismaService);
    audit = module.get(AuditService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const tenantId = 'tenant-1';
    const dto = {
      studentId: 'student-1',
      subjectId: 'subject-1',
      value: 15,
      maxValue: 20,
      coefficient: 2,
      evaluationType: 'EXAM',
      evaluationLabel: 'DS N°1',
      comment: 'Bon travail',
      semester: 1,
      periodId: 'period-1',
    };

    it('devrait créer une note avec tous les champs', async () => {
      const createdGrade = {
        id: 'grade-1',
        ...dto,
        tenantId,
        updatedBy: 'user-1',
        student: { id: 'student-1', firstName: 'Jean', lastName: 'Dupont' },
        subject: { id: 'subject-1', name: 'Mathématiques' },
      };
      mockPrisma.grade.create.mockResolvedValue(createdGrade);

      const result = await service.create(tenantId, dto, 'user-1');

      expect(result).toEqual(createdGrade);
      expect(mockPrisma.grade.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          studentId: dto.studentId,
          subjectId: dto.subjectId,
          value: dto.value,
          maxValue: dto.maxValue,
          coefficient: dto.coefficient,
          evaluationType: dto.evaluationType,
          evaluationLabel: dto.evaluationLabel,
          comment: dto.comment,
          semester: dto.semester,
          periodId: dto.periodId,
          updatedBy: 'user-1',
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          subject: { select: { id: true, name: true } },
        },
      });
      expect(mockAudit.log).toHaveBeenCalledWith({
        tenantId,
        userId: 'user-1',
        action: 'CREATE',
        entityType: 'Grade',
        entityId: 'grade-1',
        newValue: dto,
      });
    });

    it('devrait appliquer les valeurs par défaut', async () => {
      const minimalDto = {
        studentId: 'student-1',
        subjectId: 'subject-1',
        value: 12,
      };
      const createdGrade = {
        id: 'grade-2',
        studentId: 'student-1',
        subjectId: 'subject-1',
        value: 12,
        maxValue: 20,
        coefficient: 1,
        evaluationType: 'EXAM',
        semester: 1,
        tenantId,
        student: { id: 'student-1', firstName: 'Jean', lastName: 'Dupont' },
        subject: { id: 'subject-1', name: 'Mathématiques' },
      };
      mockPrisma.grade.create.mockResolvedValue(createdGrade);

      const result = await service.create(tenantId, minimalDto);

      expect(result.maxValue).toBe(20);
      expect(result.coefficient).toBe(1);
      expect(result.evaluationType).toBe('EXAM');
      expect(result.semester).toBe(1);
    });
  });

  describe('findAll', () => {
    const tenantId = 'tenant-1';
    const mockGrades = [
      { id: 'grade-1', value: 15, student: {}, subject: {}, period: {}, teacher: {} },
    ];

    it('devrait filtrer par étudiant', async () => {
      mockPrisma.grade.findMany.mockResolvedValue(mockGrades);
      const result = await service.findAll(tenantId, { studentId: 'student-1' });
      expect(result).toEqual(mockGrades);
      expect(mockPrisma.grade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ studentId: 'student-1' }) }),
      );
    });

    it('devrait filtrer par matière', async () => {
      mockPrisma.grade.findMany.mockResolvedValue(mockGrades);
      await service.findAll(tenantId, { subjectId: 'subject-1' });
      expect(mockPrisma.grade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ subjectId: 'subject-1' }) }),
      );
    });

    it('devrait filtrer par classe via student', async () => {
      mockPrisma.grade.findMany.mockResolvedValue(mockGrades);
      await service.findAll(tenantId, { classId: 'class-1' });
      expect(mockPrisma.grade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ student: { classId: 'class-1' } }) }),
      );
    });

    it('devrait retourner toutes les notes sans filtre', async () => {
      mockPrisma.grade.findMany.mockResolvedValue(mockGrades);
      const result = await service.findAll(tenantId);
      expect(result).toHaveLength(1);
      expect(mockPrisma.grade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId, deletedAt: null } }),
      );
    });
  });

  describe('calculateAveragesBySubject', () => {
    it('devrait calculer la moyenne pondérée par matière', async () => {
      mockPrisma.grade.findMany.mockResolvedValue([
        { id: 'g1', studentId: 'student-1', subjectId: 'subj-1', value: 15, maxValue: 20, coefficient: 2, tenantId: 'tenant-1' },
        { id: 'g2', studentId: 'student-1', subjectId: 'subj-1', value: 10, maxValue: 20, coefficient: 1, tenantId: 'tenant-1' },
        { id: 'g3', studentId: 'student-1', subjectId: 'subj-2', value: 18, maxValue: 20, coefficient: 3, tenantId: 'tenant-1' },
      ], { subject: { id: 'subj-1', name: 'Maths', coefficient: 2 } });

      mockPrisma.grade.findMany.mockImplementation(async ({ where }: any) => {
        const allGrades = [
          {
            id: 'g1', studentId: 'student-1', subjectId: 'subj-1', value: 15, maxValue: 20, coefficient: 2,
            subject: { id: 'subj-1', name: 'Mathématiques', coefficient: 2 },
          },
          {
            id: 'g2', studentId: 'student-1', subjectId: 'subj-1', value: 10, maxValue: 20, coefficient: 1,
            subject: { id: 'subj-1', name: 'Mathématiques', coefficient: 2 },
          },
          {
            id: 'g3', studentId: 'student-1', subjectId: 'subj-2', value: 18, maxValue: 20, coefficient: 3,
            subject: { id: 'subj-2', name: 'Physique', coefficient: 3 },
          },
        ];
        return allGrades.filter((g) => where.studentId === g.studentId);
      });

      const result = await service.calculateAveragesBySubject('student-1', 'tenant-1');

      expect(result).toHaveLength(2);

      const maths = result.find((r) => r.subject.name === 'Mathématiques');
      expect(maths).toBeDefined();
      // (15/20)*20*2 + (10/20)*20*1 = 30 + 10 = 40; totalWeight = 2 + 1 = 3; avg = 40/3 = 13.33
      expect(maths!.average).toBeCloseTo(13.33, 1);
      expect(maths!.count).toBe(2);

      const physics = result.find((r) => r.subject.name === 'Physique');
      expect(physics).toBeDefined();
      // (18/20)*20*3 = 54; totalWeight = 3; avg = 54/3 = 18
      expect(physics!.average).toBeCloseTo(18, 1);
      expect(physics!.count).toBe(1);
    });

    it('devrait retourner un tableau vide si aucune note', async () => {
      mockPrisma.grade.findMany.mockResolvedValue([]);
      const result = await service.calculateAveragesBySubject('student-1', 'tenant-1');
      expect(result).toEqual([]);
    });
  });

  describe('calculateGeneralAverage', () => {
    it('devrait calculer la moyenne générale pondérée', async () => {
      mockPrisma.grade.findMany.mockResolvedValue([
        { value: 15, maxValue: 20, coefficient: 2 },
        { value: 10, maxValue: 20, coefficient: 1 },
        { value: 18, maxValue: 20, coefficient: 3 },
      ]);

      const result = await service.calculateGeneralAverage('student-1', 'tenant-1');

      // (15/20)*20*2 + (10/20)*20*1 + (18/20)*20*3 = 30 + 10 + 54 = 94
      // totalWeight = 2 + 1 + 3 = 6
      // avg = 94/6 = 15.67
      expect(result.average).toBeCloseTo(15.67, 1);
      expect(result.count).toBe(3);
    });

    it('devrait retourner 0 si aucune note', async () => {
      mockPrisma.grade.findMany.mockResolvedValue([]);
      const result = await service.calculateGeneralAverage('student-1', 'tenant-1');
      expect(result).toEqual({ average: 0, count: 0 });
    });
  });

  describe('getStudentReport', () => {
    it('devrait retourner l\'étudiant avec les notes et les moyennes', async () => {
      const student = {
        id: 'student-1',
        firstName: 'Jean',
        lastName: 'Dupont',
        registrationNumber: 'STU-001',
        class: { id: 'class-1', name: 'CM2' },
      };
      mockPrisma.student.findFirst.mockResolvedValue(student);
      mockPrisma.grade.findMany.mockResolvedValue([
        { id: 'g1', value: 15, maxValue: 20, coefficient: 2, subjectId: 'subj-1', subject: { id: 'subj-1', name: 'Maths', coefficient: 2 }, studentId: 'student-1', tenantId: 'tenant-1' },
      ]);

      const result = await service.getStudentReport('student-1', 'tenant-1');

      expect(result).toHaveProperty('student');
      expect(result.student.id).toBe('student-1');
      expect(result).toHaveProperty('grades');
      expect(result).toHaveProperty('averages');
      expect(result).toHaveProperty('bySubject');
      expect(mockPrisma.student.findFirst).toHaveBeenCalledWith({
        where: { id: 'student-1', tenantId: 'tenant-1', deletedAt: null },
        include: { class: { select: { id: true, name: true } } },
      });
    });

    it('devrait lever NotFoundException si l\'étudiant n\'existe pas', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null);
      await expect(service.getStudentReport('invalid', 'tenant-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('devrait effectuer un soft delete', async () => {
      const existingGrade = { id: 'grade-1', value: 15, tenantId: 'tenant-1', deletedAt: null };
      mockPrisma.grade.findFirst.mockResolvedValue(existingGrade);
      mockPrisma.grade.update.mockResolvedValue({ ...existingGrade, deletedAt: new Date() });

      const result = await service.remove('grade-1', 'tenant-1', 'user-1');

      expect(result).toEqual({ message: 'Note supprimée' });
      expect(mockPrisma.grade.update).toHaveBeenCalledWith({
        where: { id: 'grade-1' },
        data: { deletedAt: expect.any(Date), updatedBy: 'user-1' },
      });
      expect(mockAudit.log).toHaveBeenCalled();
    });

    it('devrait lever NotFoundException si la note n\'existe pas', async () => {
      mockPrisma.grade.findFirst.mockResolvedValue(null);
      await expect(service.remove('invalid', 'tenant-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkCreateForClass', () => {
    it('devrait créer des notes uniquement pour les élèves de la classe', async () => {
      const tenantId = 'tenant-1';
      const classId = 'class-1';
      mockPrisma.student.findMany.mockResolvedValue([
        { id: 'student-1' },
        { id: 'student-2' },
      ]);

      const grade1 = { studentId: 'student-1', subjectId: 'subj-1', value: 15, coefficient: 2 };
      const grade2 = { studentId: 'student-2', subjectId: 'subj-1', value: 12 };
      const grade3 = { studentId: 'student-3', subjectId: 'subj-1', value: 18 };

      mockPrisma.grade.create
        .mockResolvedValueOnce({ id: 'g-1', ...grade1 })
        .mockResolvedValueOnce({ id: 'g-2', ...grade2 });

      const result = await service.bulkCreateForClass(tenantId, classId, [grade1, grade2, grade3], 'teacher-1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.grade.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.student.findMany).toHaveBeenCalledWith({
        where: { classId, tenantId, deletedAt: null },
        select: { id: true },
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BULK_CREATE',
          metadata: { classId, count: 2 },
        }),
      );
    });

    it('devrait retourner un tableau vide si aucun élève dans la classe', async () => {
      mockPrisma.student.findMany.mockResolvedValue([]);
      const result = await service.bulkCreateForClass('tenant-1', 'class-empty', [
        { studentId: 'student-1', subjectId: 'subj-1', value: 15 },
      ]);
      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('devrait retourner une note par son id', async () => {
      const grade = { id: 'grade-1', value: 15, student: {}, subject: {}, period: {}, teacher: {} };
      mockPrisma.grade.findFirst.mockResolvedValue(grade);
      const result = await service.findById('grade-1', 'tenant-1');
      expect(result).toEqual(grade);
    });

    it('devrait lever NotFoundException si introuvable', async () => {
      mockPrisma.grade.findFirst.mockResolvedValue(null);
      await expect(service.findById('invalid', 'tenant-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('devrait mettre à jour une note', async () => {
      const existing = { id: 'grade-1', value: 10, tenantId: 'tenant-1', deletedAt: null };
      const updated = { id: 'grade-1', value: 18, student: {}, subject: {} };
      mockPrisma.grade.findFirst.mockResolvedValue(existing);
      mockPrisma.grade.update.mockResolvedValue(updated);

      const result = await service.update('grade-1', 'tenant-1', { value: 18 }, 'user-1');

      expect(result).toEqual(updated);
      expect(mockAudit.log).toHaveBeenCalled();
    });

    it('devrait lever NotFoundException si la note n\'existe pas', async () => {
      mockPrisma.grade.findFirst.mockResolvedValue(null);
      await expect(service.update('invalid', 'tenant-1', { value: 18 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('publish / unpublish', () => {
    it('devrait publier une note', async () => {
      const existing = { id: 'grade-1', isPublished: false, tenantId: 'tenant-1', deletedAt: null };
      const published = { ...existing, isPublished: true };
      mockPrisma.grade.findFirst.mockResolvedValue(existing);
      mockPrisma.grade.update.mockResolvedValue(published);

      const result = await service.publish('grade-1', 'tenant-1', 'user-1');
      expect(result.isPublished).toBe(true);
    });

    it('devrait dépublier une note', async () => {
      const existing = { id: 'grade-1', isPublished: true, tenantId: 'tenant-1', deletedAt: null };
      const unpublished = { ...existing, isPublished: false };
      mockPrisma.grade.findFirst.mockResolvedValue(existing);
      mockPrisma.grade.update.mockResolvedValue(unpublished);

      const result = await service.unpublish('grade-1', 'tenant-1', 'user-1');
      expect(result.isPublished).toBe(false);
    });
  });
});
