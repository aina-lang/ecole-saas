import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    opts?: { search?: string; role?: string; page?: number; limit?: number }
  ) {
    const where: any = { tenantId };
    if (opts?.role) where.role = opts.role;
    if (opts?.search) {
      where.OR = [
        { email: { contains: opts.search, mode: 'insensitive' } },
        { firstName: { contains: opts.search, mode: 'insensitive' } },
        { lastName: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const page = opts?.page && opts.page > 0 ? opts.page : 1;
    const limit = opts?.limit && opts.limit > 0 ? opts.limit : 10;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          photoUrl: true,
          phones: {
            select: { value: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' as const },
          },
          lastLoginAt: true,
          createdAt: true,
          teacher: { select: { id: true, specialty: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: items, total, page, limit };
  }

  async findById(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        photoUrl: true,
        twoFactorEnabled: true,
        phones: {
          select: { value: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' as const },
        },
        lastLoginAt: true,
        createdAt: true,
        teacher: { select: { id: true, specialty: true } },
      },
    });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    return user;
  }

  async create(tenantId: string, dto: CreateUserDto) {
    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { tenantId, email: dto.email },
      });
      if (existing) throw new ConflictException('Cet email existe déjà');
    }

    const phones = this.normalizePhones(dto.phones);

    const data: any = {
      tenantId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
      phones: phones.length
        ? { create: phones.map((value, sortOrder) => ({ value, sortOrder })) }
        : undefined,
    };
    if (dto.email) data.email = dto.email;
    data.passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : await bcrypt.hash(Math.random().toString(36).slice(2, 10) + 'A1!', 12);

    return this.prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        photoUrl: true,
        phones: {
          select: { value: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' as const },
        },
        createdAt: true,
      },
    });
  }

  private normalizePhones(phones?: string[]): string[] {
    if (!phones) return [];
    return Array.from(
      new Set(phones.map((p) => p.trim()).filter(Boolean))
    ).slice(0, 3);
  }

  async update(id: string, tenantId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const data: any = {};
    if (dto.firstName) data.firstName = dto.firstName;
    if (dto.lastName) data.lastName = dto.lastName;
    if (dto.email) data.email = dto.email;
    if (dto.role) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.photoUrl !== undefined) data.photoUrl = dto.photoUrl;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);

    if (dto.phones !== undefined) {
      const phones = this.normalizePhones(dto.phones);
      data.phones = {
        deleteMany: {},
        create: phones.map((value, sortOrder) => ({ value, sortOrder })),
      };
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        photoUrl: true,
        phones: {
          select: { value: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' as const },
        },
      },
    });
  }

  async remove(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Utilisateur désactivé' };
  }

  async uploadAvatar(userId: string, tenantId: string, file: Express.Multer.File) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const storageBase = path.join(process.cwd(), 'storage', `tenant_${tenantId}`, 'avatars');
    fs.mkdirSync(storageBase, { recursive: true });

    if (user.photoUrl) {
      const oldPath = path.join(process.cwd(), user.photoUrl.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const ext = path.extname(file.originalname) || '.jpg';
    const fileName = `${userId}-${randomUUID()}${ext}`;
    const filePath = path.join(storageBase, fileName);
    fs.writeFileSync(filePath, file.buffer);

    const photoUrl = `/storage/tenant_${tenantId}/avatars/${fileName}`;
    await this.prisma.user.update({
      where: { id: userId },
      data: { photoUrl },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        photoUrl: true,
        phones: {
          select: { value: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' as const },
        },
      },
    });

    return { photoUrl };
  }

  async deleteAvatar(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    if (!user.photoUrl) return { message: 'Aucune photo' };

    const filePath = path.join(process.cwd(), user.photoUrl.replace(/^\//, ''));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await this.prisma.user.update({
      where: { id: userId },
      data: { photoUrl: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        photoUrl: true,
        phones: {
          select: { value: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' as const },
        },
      },
    });

    return { message: 'Photo supprimée' };
  }
}
