import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { SKIP_SUBSCRIPTION_CHECK } from '../decorators/skip-subscription-check.decorator';

/**
 * Applique le mode lecture seule aux tenants dont l'abonnement est en retard
 * (essai ou licence expirés, statut PAST_DUE) : les lectures
 * (GET) restent autorisées, toute écriture (POST/PUT/PATCH/DELETE) est bloquée
 * avec un 402 Payment Required tant que l'abonnement n'est pas régularisé.
 *
 * Global (voir app.module.ts) mais volontairement permissif par défaut : sans
 * utilisateur authentifié (login, register) ou avec
 * @SkipSubscriptionCheck(), on laisse passer — ce n'est pas ce guard qui gère
 * l'authentification, seulement la restriction d'usage une fois connecté.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_SUBSCRIPTION_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    if (!request.user?.tenantId) return true;
    if (request.method === 'GET') return true;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: request.user.tenantId },
      select: { status: true },
    });

    if (tenant?.status === 'PAST_DUE') {
      throw new HttpException(
        'Abonnement expiré ou paiement en échec — mode lecture seule. Régularisez votre abonnement pour continuer à modifier vos données.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}
