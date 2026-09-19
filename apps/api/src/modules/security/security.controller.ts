import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { structuredLog } from '../../common/structured-log';
import { summarizeCspReport } from './csp-report';

@Controller('security')
export class SecurityController {
  /** Collector for storefront CSP (enforce + Report-Only). Sem auth — o browser envia. */
  @Post('csp-report')
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  ingest(@Body() body: unknown) {
    const violations = summarizeCspReport(body);
    if (violations.length > 0) {
      structuredLog('warn', 'csp_violation', {
        count: violations.length,
        violations,
      });
    }
  }
}
