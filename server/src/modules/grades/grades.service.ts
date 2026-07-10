import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';

export interface SubjectAverage {
  subject: any;
  average: number;
  count: number;
}

@Injectable()
export class GradesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(tenantId: string, filters?: { studentId?: string; subjectId?: string; classId?: string; semester?: number; periodId?: string }) {
    const where: any = { tenantId, deletedAt: null };
    if (filters?.studentId) where.studentId = filters.studentId;
    if (filters?.subjectId) where.subjectId = filters.subjectId;
    if (filters?.semester) where.semester = filters.semester;
    if (filters?.periodId) where.periodId = filters.periodId;
    if (filters?.classId) {
      where.student = { classId: filters.classId };
    }

    return this.prisma.grade.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, registrationNumber: true } },
        subject: { select: { id: true, name: true, code: true, level: true, class: { select: { id: true, name: true } } } },
        period: { select: { id: true, label: true } },
        teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const grade = await this.prisma.grade.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, registrationNumber: true } },
        subject: { select: { id: true, name: true, code: true, level: true, class: { select: { id: true, name: true } } } },
        period: { select: { id: true, label: true } },
        teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!grade) throw new NotFoundException('Note non trouvée');
    return grade;
  }

  async create(tenantId: string, dto: CreateGradeDto, userId?: string) {
    const grade = await this.prisma.grade.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        subjectId: dto.subjectId,
        value: dto.value,
        maxValue: dto.maxValue ?? 20,
        coefficient: dto.coefficient ?? 1,
        evaluationType: dto.evaluationType ?? 'EXAM',
        evaluationLabel: dto.evaluationLabel,
        comment: dto.comment,
        semester: dto.semester ?? 1,
        periodId: dto.periodId,
        updatedBy: userId,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'Grade',
      entityId: grade.id,
      newValue: dto,
    });

    return grade;
  }

  async update(id: string, tenantId: string, dto: UpdateGradeDto, userId?: string) {
    const existing = await this.prisma.grade.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Note non trouvée');

    const data: any = { ...dto, updatedBy: userId };

    const grade = await this.prisma.grade.update({
      where: { id },
      data,
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Grade',
      entityId: id,
      oldValue: existing,
      newValue: dto,
    });

    return grade;
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const existing = await this.prisma.grade.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Note non trouvée');

    await this.prisma.grade.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'Grade',
      entityId: id,
      oldValue: existing,
    });

    return { message: 'Note supprimée' };
  }

  async bulkCreateForClass(tenantId: string, classId: string, grades: CreateGradeDto[], userId?: string) {
    const students = await this.prisma.student.findMany({
      where: { classId, tenantId, deletedAt: null },
      select: { id: true },
    });
    const studentIds = new Set(students.map((s) => s.id));

    const created: any[] = [];
    for (const grade of grades) {
      if (!studentIds.has(grade.studentId)) continue;

      const createdGrade = await this.prisma.grade.create({
        data: {
          tenantId,
          studentId: grade.studentId,
          subjectId: grade.subjectId,
          value: grade.value,
          maxValue: grade.maxValue ?? 20,
          coefficient: grade.coefficient ?? 1,
          evaluationType: grade.evaluationType ?? 'EXAM',
          evaluationLabel: grade.evaluationLabel,
          comment: grade.comment,
          semester: grade.semester ?? 1,
          periodId: grade.periodId,
          updatedBy: userId,
        },
      });
      created.push(createdGrade);
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'BULK_CREATE',
      entityType: 'Grade',
      metadata: { classId, count: created.length },
    });

    return created;
  }

  async publish(id: string, tenantId: string, userId?: string) {
    const existing = await this.prisma.grade.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Note non trouvée');

    const grade = await this.prisma.grade.update({
      where: { id },
      data: { isPublished: true, updatedBy: userId },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'PUBLISH',
      entityType: 'Grade',
      entityId: id,
    });

    return grade;
  }

  async unpublish(id: string, tenantId: string, userId?: string) {
    const existing = await this.prisma.grade.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Note non trouvée');

    const grade = await this.prisma.grade.update({
      where: { id },
      data: { isPublished: false, updatedBy: userId },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'UNPUBLISH',
      entityType: 'Grade',
      entityId: id,
    });

    return grade;
  }

  async getStudentReport(studentId: string, tenantId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: { class: { select: { id: true, name: true } } },
    });
    if (!student) throw new NotFoundException('Étudiant non trouvé');

    const grades = await this.prisma.grade.findMany({
      where: { studentId, tenantId, deletedAt: null },
      include: { subject: { select: { id: true, name: true, coefficient: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const averages = await this.calculateGeneralAverage(studentId, tenantId);
    const bySubject = await this.calculateAveragesBySubject(studentId, tenantId);

    return {
      student: { id: student.id, firstName: student.firstName, lastName: student.lastName, registrationNumber: student.registrationNumber, class: student.class },
      grades,
      averages,
      bySubject,
    };
  }

  async calculateAveragesBySubject(studentId: string, tenantId: string): Promise<SubjectAverage[]> {
    const grades = await this.prisma.grade.findMany({
      where: { studentId, tenantId, deletedAt: null },
      include: { subject: { select: { id: true, name: true, coefficient: true } } },
    });

    const subjectMap = new Map<string, { subject: any; values: number[]; maxValues: number[]; coefficients: number[] }>();

    for (const g of grades) {
      if (!subjectMap.has(g.subjectId)) {
        subjectMap.set(g.subjectId, { subject: g.subject, values: [], maxValues: [], coefficients: [] });
      }
      const entry = subjectMap.get(g.subjectId)!;
      entry.values.push(g.value);
      entry.maxValues.push(g.maxValue);
      entry.coefficients.push(g.coefficient);
    }

    const result: SubjectAverage[] = [];
    for (const [, entry] of subjectMap) {
      const weightedSum = entry.values.reduce((sum, v, i) => sum + (v / entry.maxValues[i]) * 20 * entry.coefficients[i], 0);
      const totalWeight = entry.coefficients.reduce((a, b) => a + b, 0);
      result.push({
        subject: entry.subject,
        average: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0,
        count: entry.values.length,
      });
    }

    return result;
  }

  async calculateAveragesByPeriod(studentId: string, tenantId: string, periodId: string) {
    const grades = await this.prisma.grade.findMany({
      where: { studentId, tenantId, periodId, deletedAt: null },
      include: { subject: { select: { id: true, name: true, coefficient: true } } },
    });

    if (grades.length === 0) return { average: 0, count: 0 };

    const weightedSum = grades.reduce((sum, g) => sum + (g.value / g.maxValue) * 20 * g.coefficient, 0);
    const totalWeight = grades.reduce((sum, g) => sum + g.coefficient, 0);

    const bySubject = await this.calculateAveragesBySubject(studentId, tenantId);

    return {
      periodId,
      average: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0,
      count: grades.length,
      bySubject: bySubject.filter((s) => grades.some((g) => g.subjectId === s.subject.id)),
    };
  }

  async calculateGeneralAverage(studentId: string, tenantId: string) {
    const grades = await this.prisma.grade.findMany({
      where: { studentId, tenantId, deletedAt: null },
    });

    if (grades.length === 0) return { average: 0, count: 0 };

    const weightedSum = grades.reduce((sum, g) => sum + (g.value / g.maxValue) * 20 * g.coefficient, 0);
    const totalWeight = grades.reduce((sum, g) => sum + g.coefficient, 0);

    return {
      average: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0,
      count: grades.length,
    };
  }
}
