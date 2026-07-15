import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTeacherContractDto, UpdateTeacherContractDto } from './dto/create-contract.dto';

@Injectable()
export class TeacherContractsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.teacherContract.findMany({
      where: { tenantId },
      include: {
        teacher: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByTeacher(tenantId: string, teacherId: string) {
    return this.prisma.teacherContract.findFirst({
      where: { tenantId, teacherId },
      include: {
        teacher: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
  }

  async create(tenantId: string, dto: CreateTeacherContractDto) {
    const teacher = await this.prisma.teacher.findFirst({ where: { id: dto.teacherId, tenantId } });
    if (!teacher) throw new NotFoundException('Enseignant non trouvé');

    return this.prisma.teacherContract.create({
      data: {
        tenantId,
        teacherId: dto.teacherId,
        contractType: dto.contractType,
        hourlyRate: dto.hourlyRate,
        monthlySalary: dto.monthlySalary,
        fixedAmount: dto.fixedAmount,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isActive: dto.isActive ?? true,
      },
      include: {
        teacher: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateTeacherContractDto) {
    const contract = await this.prisma.teacherContract.findFirst({ where: { id, tenantId } });
    if (!contract) throw new NotFoundException('Contrat non trouvé');

    const updated = await this.prisma.teacherContract.update({
      where: { id },
      data: {
        contractType: dto.contractType,
        hourlyRate: dto.hourlyRate,
        monthlySalary: dto.monthlySalary,
        fixedAmount: dto.fixedAmount,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        isActive: dto.isActive,
      },
      include: {
        teacher: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    // Propager vers CouchDB
    this.prisma.notifyWrite('TeacherContract', updated);

    return updated;
  }

  async remove(id: string, tenantId: string) {
    const contract = await this.prisma.teacherContract.findFirst({ where: { id, tenantId } });
    if (!contract) throw new NotFoundException('Contrat non trouvé');

    await this.prisma.teacherContract.delete({ where: { id } });
    // Propager la suppression vers CouchDB (deletedAt → _deleted)
    this.prisma.notifyWrite('TeacherContract', { id, tenantId, deletedAt: new Date() });
    return { message: 'Contrat supprimé' };
  }
}
