import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const prefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(prefix);
  // Storefront (outra origem) precisa carregar imagens da API
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  const origins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Arquivos enviados pelo admin — volume Railway em /data/uploads se configurado
  const uploadsDir = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, {
    prefix: `/${prefix}/uploads/`,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  });

  // Railway / proxies
  app.set('trust proxy', 1);

  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(
    `Lojas Schimitz API ${prefix} on :${port} env=${process.env.APP_ENV || 'development'} uploads=${uploadsDir}`,
  );
}

bootstrap();
