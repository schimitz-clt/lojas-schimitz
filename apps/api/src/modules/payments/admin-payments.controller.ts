import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ok } from '../../common/http';
import { PaymentsService } from './payments.service';

@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  async refund(@CurrentUser('sub') adminId: string, @Param('id') id: string, @Body() body?: unknown) {
    const reason = body && typeof body === 'object' && typeof (body as { reason?: unknown }).reason === 'string'
      ? String((body as { reason: string }).reason)
      : null;
    return ok(await this.payments.adminRefund(adminId, id, reason));
  }
}
