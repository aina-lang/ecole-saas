import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../../common/mail/mail.service';
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
    private mail: MailService,
  ) {}

  async registerTenant(dto: RegisterTenantDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.adminEmail.toLowerCase() },
    });
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);

    // Essai gratuit de 14 jours avec les limites du plan STARTER — pas
    // de licence tant qu'une clé n'a pas été activée depuis Paramètres > Licence.
    // Passé trialEndsAt, le cron LicenseService.expireOverdue() bascule
    // le tenant en PAST_DUE (lecture seule) s'il n'a toujours pas payé.
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.schoolName,
          plan: 'STARTER',
          status: 'TRIAL',
          trialEndsAt,
          maxStudents: 200,
          maxTeachers: 30,
          maxStorageMb: 1000,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.adminEmail.toLowerCase(),
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
      where: { email: dto.email.toLowerCase() },
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
        mustChangePassword: user.mustChangePassword ?? false,
      },
    };
  }

  // ---------------------------------------------------------------------
  // Mot de passe oublié / changement
  // ---------------------------------------------------------------------

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Réponse volontairement identique que l'e-mail existe ou non. */
  async forgotPassword(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const users = await this.prisma.user.findMany({
      where: { email, isActive: true },
      include: { tenant: { select: { name: true } } },
    });
    if (users.length > 0) {
      const token = randomBytes(32).toString('base64url');
      const expires = new Date(Date.now() + 30 * 60 * 1000);
      // Même adresse dans plusieurs établissements : un seul jeton, valable pour tous.
      await this.prisma.user.updateMany({
        where: { id: { in: users.map((u) => u.id) } },
        data: { passwordResetToken: this.hashToken(token), passwordResetExpiresAt: expires },
      });
      const schools = users.map((u) => u.tenant.name).join(', ');
      const text = [
        `Bonjour ${users[0].firstName ?? ''}`.trim() + ',',
        '',
        `Une réinitialisation du mot de passe a été demandée pour votre compte Sekoliko (${schools}).`,
        'Ouvrez l’application, cliquez sur « Mot de passe oublié ? » puis « J’ai déjà un code », et saisissez ce code :',
        '',
        `    ${token}`,
        '',
        'Il est valable 30 minutes et ne peut servir qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.',
      ].join('\n');
      const html = text.replace(/\n/g, '<br>').replace(token, `<code style="font-size:15px">${token}</code>`);
      const sent = await this.mail.send(email, 'Réinitialisation de votre mot de passe — Sekoliko', text, html);
    }
    return { message: 'Si un compte existe pour cette adresse, un e-mail contenant un code de réinitialisation vient d’être envoyé.' };
  }

  async resetPassword(token: string, password: string) {
    const hashed = this.hashToken(token.trim());
    const users = await this.prisma.user.findMany({
      where: { passwordResetToken: hashed, passwordResetExpiresAt: { gt: new Date() } },
    });
    if (users.length === 0) throw new BadRequestException('Code invalide ou expiré — refaites une demande.');
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        mustChangePassword: false,
        refreshToken: null, // déconnecte les autres sessions
      },
    });
    return { message: 'Mot de passe modifié. Vous pouvez vous connecter.' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Mot de passe actuel incorrect');
    if (currentPassword === newPassword) throw new BadRequestException('Le nouveau mot de passe doit être différent de l’actuel');
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 12), mustChangePassword: false },
    });
    return { message: 'Mot de passe modifié.' };
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

    const otpauth = `otpauth://totp/Ecole-SaaS:${encodeURIComponent(user_.email || '')}?secret=${secret}&issuer=Ecole-SaaS`;
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
