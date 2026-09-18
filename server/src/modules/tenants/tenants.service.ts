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
        plan: true,
        status: true,
        createdAt: true,
        maxStudents: true,
        _count: { select: { users: true, students: true } },
      },
    });
  }

  // L'établissement a-t-il déjà été configuré ? Sert à ne pas renvoyer vers
  // l'assistant de configuration un utilisateur qui se connecte depuis un
  // NOUVEAU poste : le drapeau « onboarding terminé » vit dans le
  // localStorage du poste, il est donc vide sur une installation neuve alors
  // que l'établissement, lui, est configuré depuis longtemps.
  //
  // Accessible à tous les rôles : un enseignant qui installe l'app sur son
  // portable doit aussi éviter l'assistant.
  async getSetupState(tenantId: string) {
    // Une année scolaire ne prouve rien : registerTenant en crée une d'office
    // à l'inscription. La compter faisait sauter l'assistant à TOUS les
    // nouveaux établissements. Font foi : les réglages que pose l'assistant,
    // ou des classes / élèves déjà saisis (établissements antérieurs aux
    // réglages répliqués).
    const [settings, classes, students] = await Promise.all([
      this.prisma.tenantSetting.count({
        where: { tenantId, key: { in: ['academic_year', 'period_system'] } },
      }),
      this.prisma.class.count({ where: { tenantId } }),
      this.prisma.student.count({ where: { tenantId } }),
    ]);
    return { configured: settings > 0 || classes > 0 || students > 0 };
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

  async createAcademicYear(id: string, label: string) {
    const startYear = parseInt(label.split('-')[0], 10) || new Date().getFullYear();

    await this.prisma.academicYear.updateMany({
      where: { tenantId: id, isCurrent: true },
      data: { isCurrent: false }
    });

    const existing = await this.prisma.academicYear.findUnique({
      where: { tenantId_label: { tenantId: id, label } },
    });

    if (existing) {
      return this.prisma.academicYear.update({
        where: { id: existing.id },
        data: {
          isCurrent: true,
          startDate: new Date(startYear, 8, 1),
          endDate: new Date(startYear + 1, 6, 30),
        },
      });
    }

    return this.prisma.academicYear.create({
      data: {
        tenantId: id,
        label,
        startDate: new Date(startYear, 8, 1),
        endDate: new Date(startYear + 1, 6, 30),
        isCurrent: true
      }
    });
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
