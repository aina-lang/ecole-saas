import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLevelDto } from './dto/create-level.dto';
import { UpdateLevelDto } from './dto/update-level.dto';

@Injectable()
export class LevelsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.level.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        _count: { select: { classes: true, feeStructures: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const level = await this.prisma.level.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        classes: { select: { id: true, name: true } },
        feeStructures: { select: { id: true, label: true, amount: true, feeType: true } },
        _count: { select: { classes: true, feeStructures: true } },
      },
    });
    if (!level) throw new NotFoundException('Niveau non trouvé');
    return level;
  }

  async create(tenantId: string, dto: CreateLevelDto) {
    const existing = await this.prisma.level.findFirst({
      where: { tenantId, name: dto.name, deletedAt: null },
    });
    if (existing) throw new ConflictException('Ce niveau existe déjà');

    const level = await this.prisma.level.create({
      data: { tenantId, name: dto.name, sortOrder: dto.sortOrder ?? 0 },
    });
    this.prisma.notifyWrite('Level', level);
    return level;
  }

  async update(id: string, tenantId: string, dto: UpdateLevelDto) {
    const level = await this.prisma.level.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!level) throw new NotFoundException('Niveau non trouvé');

    if (dto.name) {
      const existing = await this.prisma.level.findFirst({
        where: { tenantId, name: dto.name, deletedAt: null, id: { not: id } },
      });
      if (existing) throw new ConflictException('Ce niveau existe déjà');
    }

    const updated = await this.prisma.level.update({
      where: { id },
      data: {
        name: dto.name,
        sortOrder: dto.sortOrder,
      },
    });
    this.prisma.notifyWrite('Level', updated);
    return updated;
  }

  async remove(id: string, tenantId: string) {
    const level = await this.prisma.level.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        _count: { select: { classes: true, feeStructures: true } },
      },
    });
    if (!level) throw new NotFoundException('Niveau non trouvé');
    if (level._count.classes > 0) {
      throw new ConflictException('Supprimez d\'abord les classes liées à ce niveau');
    }
    if (level._count.feeStructures > 0) {
      throw new ConflictException('Supprimez d\'abord les frais liés à ce niveau');
    }

    await this.prisma.level.update({ where: { id }, data: { deletedAt: new Date() } });
    this.prisma.notifyWrite('Level', { id, tenantId, deletedAt: new Date() });
    return { message: 'Niveau supprimé' };
  }
}
