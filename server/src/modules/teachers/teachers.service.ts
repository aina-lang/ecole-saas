import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

const TEACHER_INCLUDE = {
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phones: {
        select: { value: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' as const },
      },
      isActive: true,
      role: true,
    },
  },
  classes: { select: { id: true, name: true } },
  subjects: { select: { id: true, name: true, code: true } },
};

@Injectable()
export class TeachersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.teacher.findMany({
      where: { tenantId },
      include: TEACHER_INCLUDE,
      orderBy: { user: { lastName: 'asc' } },
    });
  }

  async findById(id: string, tenantId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, tenantId },
      include: TEACHER_INCLUDE,
    });
    if (!teacher) throw new NotFoundException('Enseignant non trouvé');
    return teacher;
  }

  private normalizePhones(phones?: string[]): string[] {
    if (!phones) return [];
    return Array.from(new Set(phones.map((p) => p.trim()).filter(Boolean))).slice(0, 3);
  }

  async create(tenantId: string, dto: CreateTeacherDto, userId?: string) {
    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { tenantId, email: dto.email },
      });
      if (existing) throw new ConflictException('Cet email existe déjà');
    }

    const phones = this.normalizePhones(dto.phones);

    const userData: any = {
      tenantId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: 'TEACHER',
      phones: phones.length
        ? { create: phones.map((value, sortOrder) => ({ value, sortOrder })) }
        : undefined,
    };
    if (dto.email) userData.email = dto.email;
    userData.passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : await bcrypt.hash(Math.random().toString(36).slice(2, 10) + 'A1!', 12);

    const teacher = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: userData,
      });

      const created = await tx.teacher.create({
        data: {
          tenantId,
          userId: user.id,
          specialty: dto.specialty,
          classes: dto.classIds?.length
            ? { connect: dto.classIds.map((id) => ({ id })) }
            : undefined,
          subjects: dto.subjectIds?.length
            ? { connect: dto.subjectIds.map((id) => ({ id })) }
            : undefined,
        },
      });

      return created;
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'Teacher',
      entityId: teacher.id,
      newValue: dto,
    });

    return this.findById(teacher.id, tenantId);
  }

  async update(id: string, tenantId: string, dto: UpdateTeacherDto, userId?: string) {
    const teacher = await this.prisma.teacher.findFirst({ where: { id, tenantId } });
    if (!teacher) throw new NotFoundException('Enseignant non trouvé');

    if (dto.firstName || dto.lastName || dto.email || dto.phones !== undefined || dto.password) {
      const data: any = {};
      if (dto.firstName) data.firstName = dto.firstName;
      if (dto.lastName) data.lastName = dto.lastName;
      if (dto.email) data.email = dto.email;
      if (dto.phones !== undefined) {
        const phones = this.normalizePhones(dto.phones);
        data.phones = {
          deleteMany: {},
          create: phones.map((value, sortOrder) => ({ value, sortOrder })),
        };
      }
      if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);
      await this.prisma.user.update({ where: { id: teacher.userId }, data });
    }

    const data: any = {};
    if (dto.specialty !== undefined) data.specialty = dto.specialty;
    if (dto.classIds) data.classes = { set: dto.classIds.map((cid) => ({ id: cid })) };
    if (dto.subjectIds) data.subjects = { set: dto.subjectIds.map((sid) => ({ id: sid })) };

    if (Object.keys(data).length > 0) {
      await this.prisma.teacher.update({ where: { id }, data });
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Teacher',
      entityId: id,
      newValue: dto,
    });

    return this.findById(id, tenantId);
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const teacher = await this.prisma.teacher.findFirst({ where: { id, tenantId } });
    if (!teacher) throw new NotFoundException('Enseignant non trouvé');

    await this.prisma.user.update({
      where: { id: teacher.userId },
      data: { isActive: false },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'Teacher',
      entityId: id,
    });

    return { message: 'Enseignant désactivé' };
  }
}
