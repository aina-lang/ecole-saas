import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CODE_LENGTH, formatLicenseCode, normalizeLicenseCode } from './license-code';

/** Valeur sentinelle « illimité » pour les colonnes de quota. */
export const UNLIMITED = 1_000_000;

// Le modèle commercial : un code de licence ANNUEL, émis par l'éditeur pour
// un établissement (identifié par l'e-mail de son admin) après paiement hors
// app — mobile money, virement… — dicté ou envoyé par SMS, puis saisi dans
// l'app et vérifié ici. Pas de plan ni de quota : élèves et enseignants
// illimités. L'activation demande une connexion ; ensuite le statut est mis
// en cache côté client et l'app fonctionne hors ligne toute l'année.
@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);

  constructor(private prisma: PrismaService) {}

  /** Active un code pour le tenant courant. */
  async activate(tenantId: string, rawCode: string) {
    const code = normalizeLicenseCode(rawCode);
    if (code.length !== CODE_LENGTH) {
      throw new BadRequestException(`Le code doit comporter ${CODE_LENGTH} caractères (format XXXX-XXXX-XXXX-XXXX)`);
    }
    const license = await this.prisma.license.findUnique({ where: { code } });
    if (!license) throw new BadRequestException('Code de licence inconnu');
    if (license.tenantId !== tenantId) {
      throw new BadRequestException('Ce code de licence a été émis pour un autre établissement');
    }
    if (license.revokedAt) throw new BadRequestException('Ce code de licence a été révoqué');
    if (license.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(`Ce code de licence a expiré le ${license.expiresAt.toLocaleDateString('fr-FR')}`);
    }

    await this.prisma.$transaction([
      this.prisma.license.update({
        where: { id: license.id },
        data: { activatedAt: license.activatedAt ?? new Date() },
      }),
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: 'ACTIVE',
          plan: 'PROFESSIONAL',
          currentPeriodEnd: license.expiresAt,
          // Illimité : les colonnes de quota existent encore, on les neutralise.
          maxStudents: UNLIMITED,
          maxTeachers: UNLIMITED,
          licenseKey: code,
        },
      }),
    ]);
    this.logger.log(`Licence ${formatLicenseCode(code)} activée pour le tenant ${tenantId} jusqu'au ${license.expiresAt.toISOString()}`);
    return this.getStatus(tenantId);
  }

  async getStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        id: true, name: true, status: true, trialEndsAt: true, currentPeriodEnd: true,
        maxStudents: true, maxTeachers: true, maxStorageMb: true, licenseKey: true,
      },
    });
    const [studentCount, teacherCount, license] = await Promise.all([
      this.prisma.student.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.teacher.count({ where: { tenantId } }),
      tenant.licenseKey
        ? this.prisma.license.findUnique({
            where: { code: tenant.licenseKey },
            select: { code: true, email: true, issuedAt: true, expiresAt: true, activatedAt: true },
          })
        : null,
    ]);
    return {
      tenantId: tenant.id,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt,
      currentPeriodEnd: tenant.currentPeriodEnd,
      limits: {
        maxStudents: tenant.maxStudents,
        maxTeachers: tenant.maxTeachers,
        maxStorageMb: tenant.maxStorageMb,
        unlimited: tenant.maxStudents >= UNLIMITED,
      },
      usage: { students: studentCount, teachers: teacherCount },
      license: license
        ? { code: formatLicenseCode(license.code), email: license.email, issuedAt: license.issuedAt, expiresAt: license.expiresAt, activatedAt: license.activatedAt }
        : null,
    };
  }

  /** Essais échus et licences expirées → lecture seule (PAST_DUE). */
  @Cron(CronExpression.EVERY_HOUR)
  async expireOverdue(): Promise<void> {
    const now = new Date();
    const trials = await this.prisma.tenant.updateMany({
      where: { status: 'TRIAL', trialEndsAt: { lt: now } },
      data: { status: 'PAST_DUE' },
    });
    const licenses = await this.prisma.tenant.updateMany({
      where: { status: 'ACTIVE', currentPeriodEnd: { lt: now } },
      data: { status: 'PAST_DUE' },
    });
    if (trials.count || licenses.count) {
      this.logger.log(`${trials.count} essai(s) et ${licenses.count} licence(s) expiré(s) — passage en lecture seule`);
    }
  }
}
