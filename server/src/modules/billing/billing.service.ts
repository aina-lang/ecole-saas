import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Stripe from 'stripe';
import { PrismaService } from '../../common/prisma/prisma.service';

// L'abonnement est une licence unique (achat/renouvellement), pas un choix de
// paliers — un seul Price Stripe (STRIPE_PRICE_LICENSE).
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const secretKey = this.config.get<string>('stripe.secretKey');
    this.stripe = secretKey ? new Stripe(secretKey) : null;
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException(
        "Stripe n'est pas configuré sur ce serveur (STRIPE_SECRET_KEY manquant)",
      );
    }
    return this.stripe;
  }

  private licensePriceId(): string {
    const priceId = this.config.get<string>('stripe.licensePriceId');
    if (!priceId) {
      throw new BadRequestException('Aucun price Stripe configuré (STRIPE_PRICE_LICENSE manquant)');
    }
    return priceId;
  }

  private frontendUrl(): string {
    return this.config.get<string>('app.frontendUrl') || 'http://localhost:5173';
  }

  async ensureStripeCustomer(tenantId: string): Promise<string> {
    const stripe = this.requireStripe();
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    if (tenant.stripeCustomerId) return tenant.stripeCustomerId;

    const admin = await this.prisma.user.findFirst({
      where: { tenantId, role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      orderBy: { createdAt: 'asc' },
    });

    const customer = await stripe.customers.create({
      name: tenant.name,
      email: admin?.email,
      metadata: { tenantId },
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  async createCheckoutSession(tenantId: string): Promise<string> {
    const stripe = this.requireStripe();
    const customerId = await this.ensureStripeCustomer(tenantId);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: tenantId,
      line_items: [{ price: this.licensePriceId(), quantity: 1 }],
      subscription_data: { metadata: { tenantId } },
      success_url: `${this.frontendUrl()}/administration/billing?checkout=success`,
      cancel_url: `${this.frontendUrl()}/administration/billing?checkout=cancelled`,
    });

    if (!session.url) {
      throw new BadRequestException('Impossible de créer la session de paiement Stripe');
    }
    return session.url;
  }

  async createPortalSession(tenantId: string): Promise<string> {
    const stripe = this.requireStripe();
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    if (!tenant.stripeCustomerId) {
      throw new BadRequestException("Aucune licence Stripe pour cet établissement pour l'instant");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${this.frontendUrl()}/administration/billing`,
    });
    return session.url;
  }

  async getStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        status: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        maxStudents: true,
        maxTeachers: true,
        maxStorageMb: true,
        stripeCustomerId: true,
      },
    });

    const [studentCount, teacherCount] = await Promise.all([
      this.prisma.student.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.teacher.count({ where: { tenantId } }),
    ]);

    return {
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt,
      currentPeriodEnd: tenant.currentPeriodEnd,
      limits: {
        maxStudents: tenant.maxStudents,
        maxTeachers: tenant.maxTeachers,
        maxStorageMb: tenant.maxStorageMb,
      },
      hasStripeCustomer: !!tenant.stripeCustomerId,
      usage: { students: studentCount, teachers: teacherCount },
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const stripe = this.requireStripe();
    const webhookSecret = this.config.get<string>('stripe.webhookSecret');
    if (!webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET non configuré sur ce serveur');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      throw new BadRequestException(`Signature webhook Stripe invalide: ${err.message}`);
    }

    this.logger.log(`Webhook Stripe reçu: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.client_reference_id || (session.metadata as any)?.tenantId;
        if (tenantId && session.subscription) {
          await this.syncSubscription(tenantId, session.subscription as string);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenantId;
        if (tenantId) await this.applySubscription(tenantId, subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenantId;
        if (tenantId) {
          await this.prisma.tenant.update({ where: { id: tenantId }, data: { status: 'CANCELLED' } });
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string | null;
        if (subscriptionId) {
          const tenant = await this.prisma.tenant.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
          });
          if (tenant) {
            await this.prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'PAST_DUE' } });
            this.logger.warn(`Paiement en échec pour le tenant ${tenant.id} — passage en lecture seule`);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  private async syncSubscription(tenantId: string, subscriptionId: string): Promise<void> {
    const stripe = this.requireStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await this.applySubscription(tenantId, subscription);
  }

  private async applySubscription(tenantId: string, subscription: Stripe.Subscription): Promise<void> {
    const priceId = subscription.items.data[0]?.price?.id;
    const status = this.mapStripeStatus(subscription.status);
    const periodEndSeconds = (subscription as unknown as { current_period_end: number }).current_period_end;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        status,
        currentPeriodEnd: periodEndSeconds ? new Date(periodEndSeconds * 1000) : undefined,
      },
    });
  }

  private mapStripeStatus(stripeStatus: Stripe.Subscription.Status): 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' {
    switch (stripeStatus) {
      case 'active':
      case 'trialing':
        return 'ACTIVE';
      case 'past_due':
      case 'unpaid':
      case 'incomplete_expired':
        return 'PAST_DUE';
      case 'canceled':
        return 'CANCELLED';
      default:
        return 'ACTIVE';
    }
  }

  /** Essais expirés → lecture seule (PAST_DUE), à moins d'avoir déjà une
   * licence Stripe active (le webhook aura déjà mis status=ACTIVE avant). */
  @Cron(CronExpression.EVERY_HOUR)
  async expireOverdueTrials(): Promise<void> {
    const result = await this.prisma.tenant.updateMany({
      where: { status: 'TRIAL', trialEndsAt: { lt: new Date() } },
      data: { status: 'PAST_DUE' },
    });
    if (result.count > 0) {
      this.logger.log(`${result.count} essai(s) expiré(s) — passage en lecture seule`);
    }
  }
}
