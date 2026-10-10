import { Body, Controller, Get, Inject, Param, Post, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
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
   * Legacy full refund. `reason` is OPTIONAL (backward compatible: the current admin UI posts {}).
   * Raw body field (no DTO) so existing clients sending extra/no fields keep working; always audited.
   * Prefer POST /admin/finance/payments/:id/refunds (reason + confirm + Idempotency-Key required).
   */
  @Post(':id/refund')
  async refund(
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const reason = body && typeof body === 'object' && typeof (body as { reason?: unknown }).reason === 'string'
      ? String((body as { reason: string }).reason)
      : null;
    const result = await this.payments.adminRefund(adminId, id, reason);
    // Not confirmed yet at Mercado Pago (timeout/processing): 202 + PT-BR message, never a raw 500.
    if (result.outcome === 'processing') res.status(202);
    return ok(result);
  }
}
