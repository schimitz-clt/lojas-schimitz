import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ok } from '../../common/http';
import { FinanceAdminService } from './finance-admin.service';
import { ReconciliationService } from './reconciliation.service';
import { RefundsService } from './refunds.service';
import { ConfirmedActionDto, LedgerAdjustmentDto, ReconcileDto, RefundRequestDto, ResolveDiscrepancyDto, ReviewDto } from './dto';

/**
 * Admin "Financeiro" API. ADMIN role only (DB-backed role via JwtAuthGuard + RolesGuard).
 * Every POST requires { confirm: true, reason (>=10 chars) } and writes FinancialAuditEvent + AuditLog.
 */
@Controller('admin/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class FinanceAdminController {
  constructor(
    @Inject(FinanceAdminService) private readonly admin: FinanceAdminService,
    @Inject(ReconciliationService) private readonly recon: ReconciliationService,
    @Inject(RefundsService) private readonly refunds: RefundsService,
  ) {}

  @Get('health') async health() { return ok(await this.admin.health()); }
  @Get('dashboard') async dashboard() { return ok(await this.admin.dashboard()); }
  @Get('payments') async payments(@Query() q: Record<string, string>) { return ok(await this.admin.listPayments(q)); }
  @Get('payments/:id') async payment(@Param('id', ParseUUIDPipe) id: string) { return ok(await this.admin.paymentDetail(id)); }
  @Get('discrepancies') async discrepancies(@Query() q: Record<string, string>) { return ok(await this.admin.listDiscrepancies(q)); }
  @Get('chargebacks') async chargebacks(@Query() q: Record<string, string>) { return ok(await this.admin.listChargebacks(q)); }
  @Get('refunds') async refundList(@Query() q: Record<string, string>) { return ok(await this.admin.listRefunds(q)); }
  @Get('ledger') async ledger(@Query() q: Record<string, string>) { return ok(await this.admin.listLedger(q)); }
  @Get('audit') async audit(@Query() q: Record<string, string>) { return ok(await this.admin.listAudit(q)); }
  @Get('reconciliation-runs') async runs(@Query('limit') limit?: string) { return ok(await this.admin.listRuns(limit)); }

  @Post('reconcile')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async reconcile(@CurrentUser('sub') actorId: string, @Body() dto: ReconcileDto) {
    await this.admin.auditAction('reconciliation.requested', actorId, { orderId: dto.orderId, paymentId: dto.paymentId, reason: dto.reason, meta: { scope: dto.scope, autoRepair: !!dto.autoRepair } });
    return ok(await this.recon.run({
      scope: dto.scope, orderId: dto.orderId, paymentId: dto.paymentId,
      from: dto.from ? new Date(dto.from) : undefined, to: dto.to ? new Date(dto.to) : undefined,
      autoRepair: !!dto.autoRepair, triggeredBy: actorId, origin: 'admin',
    }));
  }

  @Post('payments/:id/reprocess')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async reprocess(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmedActionDto) {
    return ok(await this.recon.reprocessPayment(id, { actorId, origin: 'admin', reason: dto.reason }));
  }

  @Post('payments/:id/refunds')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async requestRefund(
    @CurrentUser('sub') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: RefundRequestDto,
  ) {
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 120) {
      throw new BadRequestException({ message: 'Header Idempotency-Key obrigatório (8-120 caracteres)', code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    return ok(await this.refunds.requestRefund({ paymentId: id, amount: dto.amount, reason: dto.reason, idempotencyKey, actorId, actorRole: 'admin' }));
  }

  @Post('refunds/:id/retry')
  @HttpCode(200)
  async retryRefund(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmedActionDto) {
    return ok(await this.refunds.retry(id, actorId, dto.reason));
  }

  @Post('orders/:id/release-reservation')
  @HttpCode(200)
  async releaseReservation(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmedActionDto) {
    return ok(await this.admin.releaseReservation(id, actorId, dto.reason));
  }

  @Post('payments/:id/review')
  @HttpCode(200)
  async review(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto) {
    return ok(await this.admin.markReview(id, dto.status, actorId, dto.reason));
  }

  @Post('discrepancies/:id/resolve')
  @HttpCode(200)
  async resolve(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveDiscrepancyDto) {
    return ok(await this.admin.resolveDiscrepancy(id, dto.status ?? 'RESOLVED', actorId, dto.reason));
  }

  @Post('ledger/adjustments')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async adjustment(
    @CurrentUser('sub') actorId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: LedgerAdjustmentDto,
  ) {
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 120) {
      throw new BadRequestException({ message: 'Header Idempotency-Key obrigatório (8-120 caracteres)', code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    return ok(await this.admin.createAdjustment({ idempotencyKey, direction: dto.direction, amount: dto.amount, paymentId: dto.paymentId, orderId: dto.orderId, reason: dto.reason, actorId }));
  }
}
