import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ClassesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.class.findMany({
      where: { tenantId },
      include: {
        _count: { select: { students: true, teachers: true, subjects: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id, tenantId },
      include: {
        students: {
          select: { id: true, firstName: true, lastName: true, registrationNumber: true },
          orderBy: { lastName: 'asc' },
        },
        teachers: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        subjects: {
          include: {
            teachers: {
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { students: true } },
      },
    });
    if (!cls) throw new NotFoundException('Classe non trouvée');
    return cls;
  }

  async create(tenantId: string, dto: CreateClassDto, userId?: string) {
    const existing = await this.prisma.class.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (existing) throw new ConflictException('Cette classe existe déjà');

    const cls = await this.prisma.class.create({
      data: {
        tenantId,
        name: dto.name,
        level: dto.level,
        room: dto.room,
        capacity: dto.capacity ?? 30,
        subjects: dto.subjectIds?.length
          ? { connect: dto.subjectIds.map((id) => ({ id })) }
          : undefined,
        teachers: dto.teacherIds?.length
          ? { connect: dto.teacherIds.map((id) => ({ id })) }
          : undefined,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'Class',
      entityId: cls.id,
      newValue: dto,
    });

    return cls;
  }

  async update(id: string, tenantId: string, dto: UpdateClassDto, userId?: string) {
    const cls = await this.prisma.class.findFirst({ where: { id, tenantId } });
    if (!cls) throw new NotFoundException('Classe non trouvée');

    if (dto.name) {
      const existing = await this.prisma.class.findFirst({
        where: { tenantId, name: dto.name, id: { not: id } },
      });
      if (existing) throw new ConflictException('Cette classe existe déjà');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.level !== undefined) data.level = dto.level;
    if (dto.room !== undefined) data.room = dto.room;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.subjectIds) data.subjects = { set: dto.subjectIds.map((id) => ({ id })) };
    if (dto.teacherIds) data.teachers = { set: dto.teacherIds.map((id) => ({ id })) };

    const updated = await this.prisma.class.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Class',
      entityId: id,
      oldValue: cls,
      newValue: dto,
    });

    return updated;
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { students: true } } },
    });
    if (!cls) throw new NotFoundException('Classe non trouvée');
    if (cls._count.students > 0) {
      throw new ConflictException('Impossible de supprimer une classe contenant des élèves');
    }

    await this.prisma.class.delete({ where: { id } });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'Class',
      entityId: id,
      oldValue: cls,
    });

    return { message: 'Classe supprimée' };
  }

  async assignTeacher(classId: string, teacherId: string, tenantId: string, userId?: string) {
    const cls = await this.prisma.class.findFirst({ where: { id: classId, tenantId } });
    if (!cls) throw new NotFoundException('Classe non trouvée');

    const teacher = await this.prisma.teacher.findFirst({ where: { id: teacherId, tenantId } });
    if (!teacher) throw new NotFoundException('Enseignant non trouvé');

    const updated = await this.prisma.class.update({
      where: { id: classId },
      data: { teachers: { connect: { id: teacherId } } },
      include: {
        teachers: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'ASSIGN_TEACHER',
      entityType: 'Class',
      entityId: classId,
      newValue: { teacherId },
    });

    return updated;
  }

  async removeTeacher(classId: string, teacherId: string, tenantId: string, userId?: string) {
    const cls = await this.prisma.class.findFirst({ where: { id: classId, tenantId } });
    if (!cls) throw new NotFoundException('Classe non trouvée');

    const updated = await this.prisma.class.update({
      where: { id: classId },
      data: { teachers: { disconnect: { id: teacherId } } },
      include: {
        teachers: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'REMOVE_TEACHER',
      entityType: 'Class',
      entityId: classId,
      newValue: { teacherId },
    });

    return updated;
  }

  async assignSubject(classId: string, subjectId: string, tenantId: string, userId?: string) {
    const cls = await this.prisma.class.findFirst({ where: { id: classId, tenantId } });
    if (!cls) throw new NotFoundException('Classe non trouvée');

    const subject = await this.prisma.subject.findFirst({ where: { id: subjectId, tenantId } });
    if (!subject) throw new NotFoundException('Matière non trouvée');

    const updated = await this.prisma.class.update({
      where: { id: classId },
      data: { subjects: { connect: { id: subjectId } } },
      include: { subjects: true },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'ASSIGN_SUBJECT',
      entityType: 'Class',
      entityId: classId,
      newValue: { subjectId },
    });

    return updated;
  }

  async removeSubject(classId: string, subjectId: string, tenantId: string, userId?: string) {
    const cls = await this.prisma.class.findFirst({ where: { id: classId, tenantId } });
    if (!cls) throw new NotFoundException('Classe non trouvée');

    const updated = await this.prisma.class.update({
      where: { id: classId },
      data: { subjects: { disconnect: { id: subjectId } } },
      include: { subjects: true },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'REMOVE_SUBJECT',
      entityType: 'Class',
      entityId: classId,
      newValue: { subjectId },
    });

    return updated;
  }

  async getTimetableStructure(tenantId: string) {
    const classes = await this.prisma.class.findMany({
      where: { tenantId },
      include: {
        subjects: {
          include: {
            teachers: {
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
        teachers: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        _count: { select: { students: true } },
      },
      orderBy: { name: 'asc' },
    });

    return classes.map((cls) => ({
      id: cls.id,
      name: cls.name,
      level: cls.level,
      room: cls.room,
      capacity: cls.capacity,
      studentCount: cls._count.students,
      subjects: cls.subjects.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        coefficient: s.coefficient,
        teachers: s.teachers.map((t) => ({
          id: t.id,
          firstName: t.user.firstName,
          lastName: t.user.lastName,
        })),
      })),
      teachers: cls.teachers.map((t) => ({
        id: t.id,
        firstName: t.user.firstName,
        lastName: t.user.lastName,
      })),
    }));
  }

  async getAvailableTeachers(tenantId: string) {
    return this.prisma.teacher.findMany({
      where: { tenantId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        classes: { select: { id: true, name: true } },
        subjects: { select: { id: true, name: true } },
      },
      orderBy: { user: { lastName: 'asc' } },
    });
  }
}