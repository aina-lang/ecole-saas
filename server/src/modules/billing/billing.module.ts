import { Module } from '@nestjs/common';
import { BillingController, BillingWebhookController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
