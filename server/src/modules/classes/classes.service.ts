import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';


@Injectable()
export class ClassesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.class.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        _count: { select: { students: true, teachers: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id, tenantId, deletedAt: null },
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

    // Propager vers CouchDB
    this.prisma.notifyWrite('Class', cls);

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

    // Propager la mise à jour vers CouchDB
    this.prisma.notifyWrite('Class', updated);

    return updated;
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { students: true, timetableSlots: true } },
      },
    });
    if (!cls) throw new NotFoundException('Classe non trouvée');
    if (cls._count.students > 0) {
      throw new ConflictException('Impossible de supprimer une classe contenant des élèves');
    }
    if (cls._count.timetableSlots > 0) {
      throw new ConflictException('Impossible de supprimer une classe contenant des créneaux horaires');
    }

    const updated = await this.prisma.class.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'Class',
      entityId: id,
      oldValue: cls,
      newValue: { deletedAt: updated.deletedAt },
    });

    this.prisma.notifyWrite('Class', updated);

    return { message: 'Classe supprimée' };
  }

  async restore(id: string, tenantId: string, userId?: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id, tenantId, deletedAt: { not: null } },
    });
    if (!cls) throw new NotFoundException('Classe non trouvée ou non supprimée');

    const updated = await this.prisma.class.update({
      where: { id },
      data: { deletedAt: null, version: { increment: 1 }, updatedBy: userId },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'RESTORE',
      entityType: 'Class',
      entityId: id,
      oldValue: { deletedAt: cls.deletedAt },
      newValue: { deletedAt: null },
    });

    this.prisma.notifyWrite('Class', updated);

    return updated;
  }

  async assignStudent(classId: string, studentId: string, tenantId: string, userId?: string) {
    const cls = await this.prisma.class.findFirst({ where: { id: classId, tenantId } });
    if (!cls) throw new NotFoundException('Classe non trouvée');

    const student = await this.prisma.student.findFirst({ where: { id: studentId, tenantId } });
    if (!student) throw new NotFoundException('Étudiant non trouvé');

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: { classId },
      include: {
        class: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Student',
      entityId: studentId,
      metadata: { classId },
    });

    // Propager la modification de l'étudiant vers CouchDB
    this.prisma.notifyWrite('Student', updated);

    return updated;
  }

  async removeStudent(classId: string, studentId: string, tenantId: string, userId?: string) {
    const cls = await this.prisma.class.findFirst({ where: { id: classId, tenantId } });
    if (!cls) throw new NotFoundException('Classe non trouvée');

    const student = await this.prisma.student.findFirst({ where: { id: studentId, tenantId, classId } });
    if (!student) throw new NotFoundException('Étudiant non trouvé dans cette classe');

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: { classId: null },
      include: {
        class: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Student',
      entityId: studentId,
      metadata: { removedFromClassId: classId },
    });

    // Propager la modification de l'étudiant vers CouchDB
    this.prisma.notifyWrite('Student', updated);

    return updated;
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

    // Propager la classe (avec ses relations mises à jour) vers CouchDB
    this.prisma.notifyWrite('Class', updated);

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

    // Propager la classe (avec ses relations mises à jour) vers CouchDB
    this.prisma.notifyWrite('Class', updated);

    return updated;
  }

  async getTimetableStructure(tenantId: string) {
    const [classes, allSubjects] = await Promise.all([
      this.prisma.class.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          teachers: {
            include: { user: { select: { id: true, firstName: true, lastName: true } } },
          },
          _count: { select: { students: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.subject.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          teachers: {
            include: { user: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
      }),
    ]);

    return classes.map((cls) => ({
      id: cls.id,
      name: cls.name,
      level: cls.level,
      room: cls.room,
      capacity: cls.capacity,
      studentCount: cls._count.students,
      subjects: allSubjects.map((s) => ({
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