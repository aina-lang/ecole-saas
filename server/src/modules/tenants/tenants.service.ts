import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
        plan: true,
        status: true,
        createdAt: true,
        maxStudents: true,
        _count: { select: { users: true, students: true } },
      },
    });
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, students: true, classes: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Établissement non trouvé');
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Établissement non trouvé');
    return this.prisma.tenant.update({ where: { id }, data: dto });
  }

  async suspend(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Établissement non trouvé');
    return this.prisma.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED', suspendedAt: new Date() },
    });
  }

  async activate(id: string) {
    return this.prisma.tenant.update({
      where: { id },
      data: { status: 'ACTIVE', suspendedAt: null },
    });
  }

  async getStats(id: string) {
    const [students, teachers, classes, payments] = await Promise.all([
      this.prisma.student.count({ where: { tenantId: id, deletedAt: null } }),
      this.prisma.teacher.count({ where: { tenantId: id } }),
      this.prisma.class.count({ where: { tenantId: id } }),
      this.prisma.payment.aggregate({
        where: { tenantId: id, status: 'PAID' },
        _sum: { paidAmount: true },
      }),
    ]);
    return { students, teachers, classes, totalRevenue: payments._sum.paidAmount || 0 };
  }
}
