import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSubjectDto } from './dto/create-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.subject.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        teachers: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        teachers: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!subject) throw new NotFoundException('Matière non trouvée');
    return subject;
  }

  async create(tenantId: string, dto: CreateSubjectDto, userId?: string) {
    const existing = await this.prisma.subject.findFirst({
      where: { tenantId, name: dto.name, level: dto.level ?? null },
    });
    if (existing) throw new ConflictException('Cette matière existe déjà pour ce niveau');

    const subject = await this.prisma.subject.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        level: dto.level,
        coefficient: dto.coefficient ?? 1.0,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'Subject',
      entityId: subject.id,
      newValue: dto,
    });

    // Propager vers CouchDB
    this.prisma.notifyWrite('Subject', subject);

    return subject;
  }

  async update(id: string, tenantId: string, dto: Partial<CreateSubjectDto>, userId?: string) {
    const subject = await this.prisma.subject.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!subject) throw new NotFoundException('Matière non trouvée');

    if (dto.name) {
      const existing = await this.prisma.subject.findFirst({
        where: { tenantId, name: dto.name, level: dto.level ?? null, id: { not: id } },
      });
      if (existing) throw new ConflictException('Cette matière existe déjà pour ce niveau');
    }

    const updated = await this.prisma.subject.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        level: dto.level,
        coefficient: dto.coefficient,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Subject',
      entityId: id,
      oldValue: subject,
      newValue: dto,
    });

    // Propager la mise à jour vers CouchDB
    this.prisma.notifyWrite('Subject', updated);

    return updated;
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const subject = await this.prisma.subject.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!subject) throw new NotFoundException('Matière non trouvée');

    const updated = await this.prisma.subject.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'Subject',
      entityId: id,
      oldValue: subject,
      newValue: { deletedAt: updated.deletedAt },
    });

    this.prisma.notifyWrite('Subject', updated);

    return { message: 'Matière supprimée' };
  }

  async restore(id: string, tenantId: string, userId?: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, tenantId, deletedAt: { not: null } },
    });
    if (!subject) throw new NotFoundException('Matière non trouvée ou non supprimée');

    const updated = await this.prisma.subject.update({
      where: { id },
      data: { deletedAt: null, updatedBy: userId },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'RESTORE',
      entityType: 'Subject',
      entityId: id,
      oldValue: { deletedAt: subject.deletedAt },
      newValue: { deletedAt: null },
    });

    this.prisma.notifyWrite('Subject', updated);

    return updated;
  }

  async assignTeacher(subjectId: string, teacherId: string, tenantId: string, userId?: string) {
    const subject = await this.prisma.subject.findFirst({ where: { id: subjectId, tenantId } });
    if (!subject) throw new NotFoundException('Matière non trouvée');

    const teacher = await this.prisma.teacher.findFirst({ where: { id: teacherId, tenantId } });
    if (!teacher) throw new NotFoundException('Enseignant non trouvé');

    const updated = await this.prisma.subject.update({
      where: { id: subjectId },
      data: { teachers: { connect: { id: teacherId } } },
      include: { teachers: true },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'ASSIGN_TEACHER',
      entityType: 'Subject',
      entityId: subjectId,
      newValue: { teacherId },
    });

    // Propager la matière (avec ses relations mises à jour) vers CouchDB
    this.prisma.notifyWrite('Subject', updated);

    return updated;
  }

  async removeTeacher(subjectId: string, teacherId: string, tenantId: string, userId?: string) {
    const subject = await this.prisma.subject.findFirst({ where: { id: subjectId, tenantId } });
    if (!subject) throw new NotFoundException('Matière non trouvée');

    const updated = await this.prisma.subject.update({
      where: { id: subjectId },
      data: { teachers: { disconnect: { id: teacherId } } },
      include: { teachers: true },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'REMOVE_TEACHER',
      entityType: 'Subject',
      entityId: subjectId,
      newValue: { teacherId },
    });

    // Propager la matière (avec ses relations mises à jour) vers CouchDB
    this.prisma.notifyWrite('Subject', updated);

    return updated;
  }

  async findByClass(classId: string, tenantId: string) {
    const slotSubjects = await this.prisma.timetableSlot.findMany({
      where: { classId, tenantId },
      select: { subjectId: true },
      distinct: ['subjectId'],
    });
    const subjectIds = slotSubjects.map((s) => s.subjectId);
    if (subjectIds.length === 0) return [];

    return this.prisma.subject.findMany({
      where: { id: { in: subjectIds }, tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }
}