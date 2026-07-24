import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  // rawBody: true expose req.rawBody (Buffer) sur toutes les requêtes tout en
  // continuant à parser req.body en JSON normalement — nécessaire pour
  // vérifier la signature des webhooks Stripe (BillingWebhookController), qui
  // exige le corps exact non ré-encodé.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const storagePath = process.env.STORAGE_PATH || './storage';
  app.use('/storage', express.static(join(process.cwd(), storagePath)));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}
bootstrap();
