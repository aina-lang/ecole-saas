import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as OTPAuth from 'otplib';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { LoginDto } from './dto/login.dto';
import { toDataURL } from 'qrcode';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async registerTenant(dto: RegisterTenantDto) {
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { subdomain: dto.subdomain },
    });
    if (existingTenant) {
      throw new ConflictException('Ce sous-domaine est déjà pris');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.adminEmail },
    });
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.schoolName,
          subdomain: dto.subdomain,
          plan: 'STARTER',
          status: 'ACTIVE',
          maxStudents: 200,
          maxTeachers: 30,
          maxStorageMb: 1000,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.adminEmail,
          passwordHash,
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          role: 'ADMIN',
        },
      });

      const currentYear = new Date().getFullYear();
      await tx.academicYear.create({
        data: {
          tenantId: tenant.id,
          label: `${currentYear}-${currentYear + 1}`,
          startDate: new Date(currentYear, 8, 1),
          endDate: new Date(currentYear + 1, 6, 31),
          isCurrent: true,
        },
      });

      return { tenant, user };
    });

    return {
      tenantId: result.tenant.id,
      message: 'Établissement créé avec succès',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      include: { tenant: true },
    });

    if (!user) throw new UnauthorizedException('Email ou mot de passe incorrect');
    if (!user.isActive) throw new UnauthorizedException('Ce compte est désactivé');
    if (user.tenant.status === 'SUSPENDED') throw new UnauthorizedException('Établissement suspendu');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Email ou mot de passe incorrect');

    if (user.twoFactorEnabled && !dto.twoFactorCode) {
      return { requiresTwoFactor: true, userId: user.id };
    }

    if (user.twoFactorEnabled && dto.twoFactorCode) {
      if (!user.twoFactorSecret) throw new UnauthorizedException('2FA non configuré');
      const isValid = OTPAuth.verify({
        token: dto.twoFactorCode,
        secret: user.twoFactorSecret,
      });
      if (!isValid) throw new UnauthorizedException('Code 2FA invalide');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(user);
  }

  private async generateTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await bcrypt.hash(refreshToken, 10) },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.refreshToken) throw new UnauthorizedException();

      const valid = await bcrypt.compare(refreshToken, user.refreshToken);
      if (!valid) throw new UnauthorizedException();

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Token de rafraîchissement invalide');
    }
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, tenantId: true, firstName: true, lastName: true, isActive: true },
    });
  }

  async setupTwoFactor(userId: string) {
    const secret = OTPAuth.generateSecret();
    const user_ = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user_) throw new UnauthorizedException('Utilisateur non trouvé');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    const otpauth = `otpauth://totp/Ecole-SaaS:${encodeURIComponent(user_.email)}?secret=${secret}&issuer=Ecole-SaaS`;
    const qrCode = await toDataURL(otpauth);
    return { secret, qrCode };
  }

  async verifyTwoFactor(userId: string, token: string) {
    const user_ = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user_ || !user_.twoFactorSecret) throw new UnauthorizedException('Utilisateur non trouvé');
    const isValid = OTPAuth.verify({ token, secret: user_.twoFactorSecret });
    if (!isValid) throw new UnauthorizedException('Code 2FA invalide');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { message: '2FA activé avec succès' };
  }
}
