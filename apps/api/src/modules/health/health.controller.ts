import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../../common/http';
import { PrismaService } from '../../prisma.service';
import { mailConfiguredFromEnvPresence } from '../mail/mail.config';
import { firebaseConfiguredFromEnvPresence } from '../push/push-fcm.config';
import {
  isUploadsDirPersistent,
  resolveUploadsDir,
} from '../uploads/uploads-durability';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness healthcheck (no DB)' })
  check() {
    const uploadsDir = resolveUploadsDir(process.env.UPLOADS_DIR);
    return ok({
      service: 'lojas-schimitz-api',
      env: process.env.APP_ENV || 'development',
      time: new Date().toISOString(),
      /** Env names only (MAIL_FROM + RESEND_API_KEY|SMTP_HOST) — never secret values. */
      mailConfigured: mailConfiguredFromEnvPresence(),
      /** Env names only (FIREBASE_SERVICE_ACCOUNT_JSON|BASE64 or ADC path) — never secret values. */
      fcmConfigured: firebaseConfiguredFromEnvPresence(),
      /** Real path check: UPLOADS_DIR under /data (DEPLOY.md Volume). No path leaked. */
      uploadsPersistent: isUploadsDirPersistent(uploadsDir),
    });
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness — DB ping (SELECT 1)' })
  async ready() {
    const time = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const uploadsDir = resolveUploadsDir(process.env.UPLOADS_DIR);
      return ok({
        service: 'lojas-schimitz-api',
        ready: true,
        db: 'up',
        env: process.env.APP_ENV || 'development',
        time,
        mailConfigured: mailConfiguredFromEnvPresence(),
        fcmConfigured: firebaseConfiguredFromEnvPresence(),
        /** Real path check: UPLOADS_DIR under /data (DEPLOY.md Volume). No path leaked. */
        uploadsPersistent: isUploadsDirPersistent(uploadsDir),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'NOT_READY',
        message: 'Database unavailable',
      });
    }
  }
}
