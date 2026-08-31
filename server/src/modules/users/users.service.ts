import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { MailService } from '../../common/mail/mail.service';
import { generateTemporaryPassword, credentialsMail } from '../../common/mail/temporary-password';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private mail: MailService) {}

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
    // Sans mot de passe fourni : mot de passe TEMPORAIRE généré, renvoyé à
    // l'administrateur (affiché à l'écran) et envoyé par e-mail à l'utilisateur ;
    // changement obligatoire à la première connexion.
    const temporaryPassword = dto.password ? null : generateTemporaryPassword();
    data.passwordHash = await bcrypt.hash(dto.password ?? temporaryPassword!, 12);
    if (temporaryPassword) data.mustChangePassword = true;

    const created = await this.prisma.user.create({
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
        createdAt: true,
      },
    });
    this.prisma.notifyWrite('User', { ...created, tenantId });

    let credentialsEmailed = false;
    if (temporaryPassword && created.email) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      const mail = credentialsMail({ firstName: created.firstName, email: created.email, password: temporaryPassword, schoolName: tenant?.name });
      credentialsEmailed = await this.mail.send(created.email, mail.subject, mail.text, mail.html);
    }
    return { ...created, temporaryPassword, credentialsEmailed };
  }

  async resetPassword(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    const temporaryPassword = generateTemporaryPassword();
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(temporaryPassword, 12), mustChangePassword: true, refreshToken: null, passwordResetToken: null, passwordResetExpiresAt: null },
    });
    let credentialsEmailed = false;
    if (user.email) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      const mail = credentialsMail({ firstName: user.firstName, email: user.email, password: temporaryPassword, schoolName: tenant?.name });
      credentialsEmailed = await this.mail.send(user.email, mail.subject, mail.text, mail.html);
    }
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, temporaryPassword, credentialsEmailed };
  }

  private normalizePhones(phones?: string[]): string[] {
    if (!phones) return [];
    return Array.from(
      new Set(phones.map((p) => p.trim()).filter(Boolean))
    ).slice(0, 3);
  }

  /** Compte fondateur de l'établissement : le premier administrateur créé.
   * Il ne peut être ni supprimé, ni désactivé, ni rétrogradé — sinon
   * l'établissement peut se retrouver sans administrateur. */
  private async assertNotFounder(user: { id: string; tenantId: string }, action: string) {
    const founder = await this.prisma.user.findFirst({
      where: { tenantId: user.tenantId, role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (founder && founder.id === user.id) {
      throw new ForbiddenException(`Le compte fondateur de l'établissement ne peut pas être ${action}`);
    }
  }

  async update(id: string, tenantId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    if (dto.isActive === false) await this.assertNotFounder(user, 'désactivé');
    if (dto.role && dto.role !== 'ADMIN' && dto.role !== 'SUPER_ADMIN') await this.assertNotFounder(user, 'rétrogradé');

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

    const updated = await this.prisma.user.update({
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
    this.prisma.notifyWrite('User', { ...updated, tenantId });
    return updated;
  }

  async remove(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    await this.assertNotFounder(user, 'supprimé');
    const deactivated = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    this.prisma.notifyWrite('User', deactivated);
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
    fs.writeFileSync(filePath, new Uint8Array(file.buffer));

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
