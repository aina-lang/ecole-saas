import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { QueryStudentDto } from './dto/query-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private async generateRegistrationNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `STU-${year}-`;

    const lastStudent = await this.prisma.student.findFirst({
      where: { registrationNumber: { startsWith: prefix } },
      orderBy: { registrationNumber: 'desc' },
      select: { registrationNumber: true },
    });

    let counter = 1;
    if (lastStudent) {
      const parts = lastStudent.registrationNumber.split('-');
      counter = parseInt(parts[2], 10) + 1;
    }

    return `${prefix}${String(counter).padStart(5, '0')}`;
  }

  async findAll(tenantId: string, query: QueryStudentDto) {
    const { search, classId, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId, deletedAt: null };

    if (classId) where.classId = classId;
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { registrationNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          parents: {
            include: {
              parent: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.student.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, tenantId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        class: { select: { id: true, name: true } },
        parents: {
          include: {
            parent: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!student) throw new NotFoundException('Étudiant non trouvé');
    return student;
  }

  async create(tenantId: string, dto: CreateStudentDto, userId?: string) {
    const registrationNumber = await this.generateRegistrationNumber(tenantId);

    if (dto.email) {
      const existing = await this.prisma.student.findFirst({
        where: { email: dto.email, tenantId, deletedAt: null },
      });
      if (existing) throw new ConflictException('Cet email est déjà utilisé par un autre étudiant');
    }

    const { parents, ...studentData } = dto;

    const student = await this.prisma.student.create({
      data: {
        ...studentData,
        tenantId,
        registrationNumber,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        parents: parents?.length
          ? {
              create: parents.map((p) => ({
                parentId: p.parentId,
                relation: p.relation ?? 'PARENT',
                isPrimary: p.isPrimary ?? false,
              })),
            }
          : undefined,
      },
      include: {
        class: { select: { id: true, name: true } },
        parents: {
          include: {
            parent: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'Student',
      entityId: student.id,
      newValue: { registrationNumber: student.registrationNumber, firstName: student.firstName, lastName: student.lastName },
    });

    return student;
  }

  async update(id: string, tenantId: string, dto: UpdateStudentDto, userId?: string) {
    const existing = await this.prisma.student.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Étudiant non trouvé');

    if (dto.email && dto.email !== existing.email) {
      const emailConflict = await this.prisma.student.findFirst({
        where: { email: dto.email, tenantId, id: { not: id }, deletedAt: null },
      });
      if (emailConflict) throw new ConflictException('Cet email est déjà utilisé par un autre étudiant');
    }

    const { parents, ...studentData } = dto;

    const updateData: any = { ...studentData };
    if (dto.birthDate) updateData.birthDate = new Date(dto.birthDate);
    updateData.version = { increment: 1 };
    if (userId) updateData.updatedBy = userId;

    const student = await this.prisma.$transaction(async (tx) => {
      if (parents !== undefined) {
        await tx.studentParent.deleteMany({ where: { studentId: id } });
        if (parents.length > 0) {
          await tx.studentParent.createMany({
            data: parents.map((p) => ({
              studentId: id,
              parentId: p.parentId,
              relation: p.relation ?? 'PARENT',
              isPrimary: p.isPrimary ?? false,
            })),
          });
        }
      }

      return tx.student.update({
        where: { id },
        data: updateData,
        include: {
          class: { select: { id: true, name: true } },
          parents: {
            include: {
              parent: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      });
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Student',
      entityId: student.id,
      oldValue: { firstName: existing.firstName, lastName: existing.lastName },
      newValue: { firstName: student.firstName, lastName: student.lastName },
    });

    return student;
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Étudiant non trouvé');

    await this.prisma.student.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 }, updatedBy: userId },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'Student',
      entityId: id,
      oldValue: { registrationNumber: student.registrationNumber, firstName: student.firstName, lastName: student.lastName },
    });

    return { message: 'Étudiant supprimé avec succès' };
  }

  async restore(id: string, tenantId: string, userId?: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId, deletedAt: { not: null } },
    });
    if (!student) throw new NotFoundException('Étudiant non trouvé ou non supprimé');

    await this.prisma.student.update({
      where: { id },
      data: { deletedAt: null, version: { increment: 1 }, updatedBy: userId },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'RESTORE',
      entityType: 'Student',
      entityId: id,
      oldValue: { deletedAt: student.deletedAt },
    });

    return { message: 'Étudiant restauré avec succès' };
  }

  async findDeleted(tenantId: string) {
    return this.prisma.student.findMany({
      where: { tenantId, deletedAt: { not: null } },
      include: {
        class: { select: { id: true, name: true } },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }
}