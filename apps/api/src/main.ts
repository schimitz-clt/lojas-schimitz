import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { applyHttpBodyParsers } from './common/http-body-parsers';
import { setupSwagger, shouldEnableSwagger } from './common/swagger';
import { requestIdMiddleware } from './common/request-id';
import { csrfOriginMiddleware } from './common/csrf-origin';
import { logProcessError } from './common/error-log';

// H4: crashes / stray promise rejections leave a structured, masked line in Railway logs.
// Behaviour kept as Node's default: the process still exits(1) and Railway restarts it.
process.on('unhandledRejection', (reason) => {
  logProcessError('UNHANDLED_REJECTION', reason);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logProcessError('UNCAUGHT_EXCEPTION', err);
  process.exit(1);
});

async function bootstrap() {
  // bodyParser: false — register json + urlencoded + CSP report types ourselves.
  // CSP-only typed parsers (PR #60) left application/json bodies empty in prod.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // H4: every response carries x-request-id; 5xx log lines use the same id.
  app.use(requestIdMiddleware);
  // CSRF: ação que altera dados com cookie de sessão exige Origin conhecido (CSRF_ORIGIN_CHECK=off desliga).
  app.use(csrfOriginMiddleware);
  applyHttpBodyParsers(app);
  const prefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(prefix);
  const swaggerOn = shouldEnableSwagger();
  // Storefront (outra origem) precisa carregar imagens da API
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Swagger UI usa inline assets; desliga CSP só quando docs estão ativos
      contentSecurityPolicy: swaggerOn ? false : undefined,
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
  // Express 5 mudou o padrão para 'simple'; mantém o parser de query do Express 4 (contrato da API).
  app.set('query parser', 'extended');

  setupSwagger(app, prefix);

  installGracefulShutdown(app);

  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(
    `Lojas Schimitz API ${prefix} on :${port} env=${process.env.APP_ENV || 'development'} uploads=${uploadsDir}`,
  );
}

bootstrap();

/**
 * Deploy sem cortar requisições: no SIGTERM do Railway (drainingSeconds no railway.toml) a API para
 * de aceitar conexões, termina as que estão em andamento e roda os hooks de shutdown (flush final das
 * métricas financeiras, $disconnect do Prisma) antes de sair. Handler próprio em vez de
 * app.enableShutdownHooks(): o Nest re-emite o sinal para o próprio processo depois do close, e como
 * PID 1 do container (docker-entrypoint.sh faz exec node) o kernel ignora esse sinal — o processo
 * ficaria pendurado até o SIGKILL.
 */
function installGracefulShutdown(app: { close(): Promise<void> }, graceMs = 8000) {
  let closing = false;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      if (closing) return;
      closing = true;
      // eslint-disable-next-line no-console
      console.log(`${signal}: encerrando a API (drenando requisições, hooks de shutdown)`);
      const force = setTimeout(() => process.exit(0), graceMs);
      force.unref();
      app.close().then(
        () => process.exit(0),
        (err) => {
          // eslint-disable-next-line no-console
          console.error('shutdown', err);
          process.exit(1);
        },
      );
    });
  }
}
