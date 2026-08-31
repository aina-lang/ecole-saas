import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  // rawBody: true expose req.rawBody (Buffer) — conservé pour d'éventuels
  // webhooks signés ; sans effet sur les autres routes.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    exposedHeaders: ['X-Server-Time'],
  });

  // Ancre temporelle pour les clients : l'app desktop corrige son horloge
  // locale avec cet en-tête (licence hors ligne, tampons de synchro).
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('X-Server-Time', String(Date.now()));
    next();
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

  // Dépôt des mises à jour de l'app desktop (electron-updater, fournisseur
  // « generic » — voir frontend/electron-builder.yml). On y dépose le
  // latest.yml et l'installateur .exe produits par `npm run build:win`.
  //
  // latest.yml ne doit jamais être mis en cache : c'est le fichier qui annonce
  // la nouvelle version, et un cache intermédiaire laisserait les postes sur
  // l'ancienne indéfiniment. L'installateur, lui, porte le numéro de version
  // dans son nom : il est immuable et peut être caché longtemps.
  const updatesPath = process.env.UPDATES_PATH || './updates';
  app.use(
    '/updates',
    express.static(join(process.cwd(), updatesPath), {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.yml')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}
bootstrap();
