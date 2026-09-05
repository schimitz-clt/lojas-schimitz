import { Controller, Get } from '@nestjs/common';
import { ok } from '../../common/http';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return ok({
      service: 'lojas-schimitz-api',
      env: process.env.APP_ENV || 'development',
      time: new Date().toISOString(),
    });
  }
}
