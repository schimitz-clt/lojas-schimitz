import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../../common/http';
import { PrismaService } from '../../prisma.service';
import { mailConfiguredFromEnvPresence } from '../mail/mail.config';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness healthcheck (no DB)' })
  check() {
    return ok({
      service: 'lojas-schimitz-api',
      env: process.env.APP_ENV || 'development',
      time: new Date().toISOString(),
      /** Env names only (MAIL_FROM + RESEND_API_KEY|SMTP_HOST) — never secret values. */
      mailConfigured: mailConfiguredFromEnvPresence(),
    });
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness — DB ping (SELECT 1)' })
  async ready() {
    const time = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return ok({
        service: 'lojas-schimitz-api',
        ready: true,
        db: 'up',
        env: process.env.APP_ENV || 'development',
        time,
        mailConfigured: mailConfiguredFromEnvPresence(),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'NOT_READY',
        message: 'Database unavailable',
      });
    }
  }
}
