import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminAuditInterceptor } from '../../common/admin-audit.interceptor';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ok } from '../../common/http';
import { PaymentsService } from './payments.service';

@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Roles('admin')
export class AdminPaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  /** Open PaymentReconciliation rows (orphan webhooks needing ops follow-up). No secrets. */
  @Get('reconciliations')
  async listReconciliations(@Query('limit') limit?: string) {
    const n = limit != null && limit !== '' ? Number(limit) : 50;
    return ok(await this.payments.listOpenReconciliations(Number.isFinite(n) ? n : 50));
  }

  /**
   * Legacy full refund. `reason` is REQUIRED (min. 5 chars after trim, same rule as the admin UI,
   * which already sends it): empty/missing → 400 REASON_REQUIRED before anything reaches Mercado Pago.
   * Raw body field (no DTO) so clients sending extra fields keep working; always audited.
   * Prefer POST /admin/finance/payments/:id/refunds (reason + confirm + Idempotency-Key required).
   */
  @Post(':id/refund')
  async refund(
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const reason = parseLegacyRefundReason(body);
    const result = await this.payments.adminRefund(adminId, id, reason);
    // Not confirmed yet at Mercado Pago (timeout/processing): 202 + PT-BR message, never a raw 500.
    if (result.outcome === 'processing') res.status(202);
    return ok(result);
  }
}

export const LEGACY_REFUND_REASON_MIN = 5;

/** Motivo obrigatório no estorno legado: string com ≥5 caracteres úteis (espaços colapsados), máx. 500. */
export function parseLegacyRefundReason(body: unknown): string {
  const raw = body && typeof body === 'object' ? (body as { reason?: unknown }).reason : undefined;
  const reason = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, 500) : '';
  if (reason.length < LEGACY_REFUND_REASON_MIN) {
    throw new BadRequestException({
      message: `Motivo do estorno obrigatório (mín. ${LEGACY_REFUND_REASON_MIN} caracteres). Nada foi enviado ao Mercado Pago.`,
      code: 'REASON_REQUIRED',
    });
  }
  return reason;
}
