import { Controller, Get, Post, UseGuards, Req, Headers, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SkipSubscriptionCheck } from '../../common/decorators/skip-subscription-check.decorator';

// Un tenant en lecture seule (essai expiré / paiement en échec) doit pouvoir
// consulter son statut et payer — sinon il n'a aucun moyen de sortir de cet
// état depuis l'app elle-même.
@Controller('billing')
@UseGuards(AuthGuard('jwt'))
@SkipSubscriptionCheck()
export class BillingController {
  constructor(private billing: BillingService) {}

  @Get('status')
  getStatus(@CurrentUser('tenantId') tenantId: string) {
    return this.billing.getStatus(tenantId);
  }

  @Post('checkout')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async createCheckout(@CurrentUser('tenantId') tenantId: string) {
    const url = await this.billing.createCheckoutSession(tenantId);
    return { url };
  }

  @Post('portal')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async createPortal(@CurrentUser('tenantId') tenantId: string) {
    const url = await this.billing.createPortalSession(tenantId);
    return { url };
  }
}

// Endpoint appelé directement par Stripe (pas par l'app) : ni JWT, ni tenant
// courant — l'authenticité vient de la signature Stripe, vérifiée dans
// BillingService.handleWebhook via le corps brut de la requête (rawBody,
// activé globalement dans main.ts).
@Controller('billing')
export class BillingWebhookController {
  constructor(private billing: BillingService) {}

  @Post('webhook')
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
    if (!req.rawBody) {
      throw new BadRequestException('Corps de requête brut manquant');
    }
    await this.billing.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}
