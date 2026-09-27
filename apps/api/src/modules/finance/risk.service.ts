import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { structuredLog } from '../../common/structured-log';
import { evaluateRisk, riskConfigFromEnv, type RiskResult } from './risk-engine';
import { FinancialRecorder } from './financial-recorder.service';

@Injectable()
export class RiskService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FinancialRecorder) private readonly recorder: FinancialRecorder,
  ) {}

  /** Collect real signals from the DB, evaluate rules, persist the assessment. */
  async assess(orderId: string, opts: { paymentId?: string | null; trigger: string }): Promise<RiskResult & { id: string } | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, total: true, userId: true, publicId: true, user: { select: { createdAt: true } } },
    });
    if (!order) return null;
    const cfg = riskConfigFromEnv();
    const since = new Date(Date.now() - cfg.velocityWindowMinutes * 60_000);
    const [refused, ordersInWindow, openRecon, priorCb] = await Promise.all([
      this.prisma.payment.count({ where: { orderId, status: 'refused' } }),
      order.userId ? this.prisma.order.count({ where: { userId: order.userId, createdAt: { gte: since } } }) : Promise.resolve(0),
      this.prisma.paymentReconciliation.count({
        where: { externalReference: order.publicId, status: 'RECONCILIATION_REQUIRED', resolvedAt: null },
      }),
      this.priorChargebacks(order.userId, orderId),
    ]);
    const accountAgeHours = order.user?.createdAt ? (Date.now() - order.user.createdAt.getTime()) / 3_600_000 : null;
    const result = evaluateRisk(
      {
        orderTotal: Number(order.total),
        accountAgeHours,
        refusedAttempts: refused,
        ordersInWindow,
        openReconciliationForOrder: openRecon > 0,
        priorChargebacks: priorCb,
      },
      cfg,
    );
    const row = await this.prisma.riskAssessment.create({
      data: {
        orderId,
        paymentId: opts.paymentId ?? null,
        decision: result.decision,
        score: result.score,
        hits: result.hits as object,
        rulesetVersion: result.rulesetVersion,
        trigger: opts.trigger,
      },
    });
    if (result.decision === 'REVIEW' && opts.paymentId) {
      const updated = await this.prisma.payment.updateMany({
        where: { id: opts.paymentId, reviewStatus: null },
        data: { reviewStatus: 'UNDER_REVIEW' },
      });
      if (updated.count > 0) {
        await this.recorder.auditSafe({
          action: 'payment.review_flagged',
          origin: 'system',
          orderId,
          paymentId: opts.paymentId,
          amount: Number(order.total),
          reason: result.hits.map((h) => h.ruleId).join(','),
          meta: { riskAssessmentId: row.id, score: result.score },
        });
      }
      structuredLog('warn', 'RISK_REVIEW', { orderId, paymentId: opts.paymentId, score: result.score, rules: result.hits.map((h) => h.ruleId) });
    }
    return { ...result, id: row.id };
  }

  private async priorChargebacks(userId: string | null, excludeOrderId: string): Promise<number> {
    if (!userId) return 0;
    const orders = await this.prisma.order.findMany({ where: { userId, id: { not: excludeOrderId } }, select: { id: true }, take: 500 });
    if (!orders.length) return 0;
    return this.prisma.chargeback.count({ where: { orderId: { in: orders.map((o) => o.id) } } });
  }

  async assessSafe(orderId: string, opts: { paymentId?: string | null; trigger: string }) {
    try {
      return await this.assess(orderId, opts);
    } catch (e: any) {
      structuredLog('error', 'RISK_ASSESS_FAILED', { orderId, error: String(e?.message || e).slice(0, 200) });
      return null;
    }
  }
}
