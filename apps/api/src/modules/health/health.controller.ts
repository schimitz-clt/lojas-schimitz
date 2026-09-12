import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../../common/http';
import { mailConfiguredFromEnvPresence } from '../mail/mail.config';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Healthcheck' })
  check() {
    return ok({
      service: 'lojas-schimitz-api',
      env: process.env.APP_ENV || 'development',
      time: new Date().toISOString(),
      /** Env names only (MAIL_FROM + RESEND_API_KEY|SMTP_HOST) — never secret values. */
      mailConfigured: mailConfiguredFromEnvPresence(),
    });
  }
}
