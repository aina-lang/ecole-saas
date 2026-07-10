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
      where: { tenantId },
      include: {
        class: { select: { id: true, name: true } },
        teachers: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, tenantId },
      include: {
        class: { select: { id: true, name: true } },
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

    if (dto.classId) {
      const cls = await this.prisma.class.findFirst({
        where: { id: dto.classId, tenantId },
      });
      if (!cls) throw new NotFoundException('Classe non trouvée');
    }

    const subject = await this.prisma.subject.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        level: dto.level,
        coefficient: dto.coefficient ?? 1.0,
        classId: dto.classId,
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

    return subject;
  }

  async update(id: string, tenantId: string, dto: Partial<CreateSubjectDto>, userId?: string) {
    const subject = await this.prisma.subject.findFirst({ where: { id, tenantId } });
    if (!subject) throw new NotFoundException('Matière non trouvée');

    if (dto.name) {
      const existing = await this.prisma.subject.findFirst({
        where: { tenantId, name: dto.name, level: dto.level ?? null, id: { not: id } },
      });
      if (existing) throw new ConflictException('Cette matière existe déjà pour ce niveau');
    }

    if (dto.classId) {
      const cls = await this.prisma.class.findFirst({
        where: { id: dto.classId, tenantId },
      });
      if (!cls) throw new NotFoundException('Classe non trouvée');
    }

    const updated = await this.prisma.subject.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        level: dto.level,
        coefficient: dto.coefficient,
        classId: dto.classId,
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

    return updated;
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const subject = await this.prisma.subject.findFirst({ where: { id, tenantId } });
    if (!subject) throw new NotFoundException('Matière non trouvée');

    await this.prisma.subject.delete({ where: { id } });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'Subject',
      entityId: id,
      oldValue: subject,
    });

    return { message: 'Matière supprimée' };
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

    return updated;
  }

  async findByClass(classId: string, tenantId: string) {
    return this.prisma.subject.findMany({
      where: { tenantId, classId },
      orderBy: { name: 'asc' },
    });
  }
}