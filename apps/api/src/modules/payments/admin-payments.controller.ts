import { Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
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

  @Post(':id/refund')
  async refund(@CurrentUser('sub') adminId: string, @Param('id') id: string) {
    return ok(await this.payments.adminRefund(adminId, id));
  }
}
