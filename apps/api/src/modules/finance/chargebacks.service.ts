import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { structuredLog } from '../../common/structured-log';
import type { FetchPaymentResult, PaymentProvider } from '../payments/payment.provider';
import { FinancialRecorder } from './financial-recorder.service';
import { financeMetrics } from './finance-metrics';

export type ChargebackStatus = 'OPENED' | 'IN_REVIEW' | 'WON' | 'LOST' | 'UNKNOWN';

/** Chargeback case status derived from what the PAYMENT reports at MP (source of truth). */
export function chargebackStatusFromPayment(rawStatus?: string | null, statusDetail?: string | null): ChargebackStatus | null {
  const raw = String(rawStatus || '').toLowerCase();
  const detail = String(statusDetail || '').toLowerCase();
  if (raw === 'in_mediation') return 'IN_REVIEW';
  if (raw === 'charged_back') {
    if (detail === 'reimbursed') return 'WON';
    if (detail === 'settled') return 'LOST';
    return 'OPENED';
  }
  return null;
}

export function isChargebackTopic(topic?: string | null, action?: string | null) {
  const t = String(topic || '').toLowerCase();
  const a = String(action || '').toLowerCase();
  return t.includes('chargeback') || a.includes('chargeback');
}

/**
 * Chargebacks / disputes. Uses only documented Mercado Pago capabilities:
 *  - payment status `charged_back` / `in_mediation` (GET /v1/payments/{id})
 *  - chargeback notifications (topic_chargebacks_wh) + GET /v1/chargebacks/{id}
 * Submitting dispute documentation is NOT automated (operator does it in the MP panel).
 */
@Injectable()
export class ChargebacksService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject('PaymentProvider') private readonly provider: PaymentProvider,
    @Inject(FinancialRecorder) private readonly recorder: FinancialRecorder,
  ) {}

  private providerName() {
    return this.provider.name === 'null' ? 'null' : 'mercadopago';
  }

  /** Payment webhook revealed a dispute/chargeback: upsert the case keyed by the payment. */
  async ensureFromPaymentStatus(local: { id: string; orderId: string; externalId: string | null; amount: unknown }, fetched: FetchPaymentResult) {
    const status = chargebackStatusFromPayment(fetched.rawStatus, fetched.statusDetail);
    if (!status || !local.externalId) return null;
    const existingCase = await this.prisma.chargeback.findFirst({
      where: { provider: this.providerName(), externalPaymentId: local.externalId, NOT: { providerCaseId: `payment:${local.externalId}` } },
      orderBy: { createdAt: 'desc' },
    });
    const caseId = existingCase?.providerCaseId || `payment:${local.externalId}`;
    const row = await this.prisma.chargeback.upsert({
      where: { provider_providerCaseId: { provider: this.providerName(), providerCaseId: caseId } },
      create: {
        provider: this.providerName(),
        providerCaseId: caseId,
        paymentId: local.id,
        orderId: local.orderId,
        externalPaymentId: local.externalId,
        amount: Number(local.amount),
        currency: 'BRL',
        reason: fetched.rawStatus === 'in_mediation' ? 'mediation' : null,
        status,
        providerStatusDetail: fetched.statusDetail ?? null,
      },
      update: { status, providerStatusDetail: fetched.statusDetail ?? null, paymentId: local.id, orderId: local.orderId },
    });
    await this.recorder.auditSafe({
      action: 'chargeback.status_observed',
      origin: 'webhook',
      orderId: local.orderId,
      paymentId: local.id,
      amount: Number(local.amount),
      newState: status,
      meta: { chargebackId: row.id, providerStatus: fetched.rawStatus, detail: fetched.statusDetail ?? null },
    });
    if (status === 'OPENED' || status === 'IN_REVIEW') {
      await this.recorder.openDiscrepancy(this.prisma, {
        type: 'CHARGEBACK_OPEN',
        severity: 'HIGH',
        dedupeKey: `CHARGEBACK_OPEN:${row.id}`,
        message: `Disputa/chargeback aberto no pagamento ${local.externalId} — responder no painel Mercado Pago dentro do prazo`,
        orderId: local.orderId,
        paymentId: local.id,
        externalId: local.externalId,
      });
    }
    return row;
  }

  /**
   * Chargeback notification (topic_chargebacks_wh). Fetches the case; on success links the payment
   * and re-syncs its state from GET /v1/payments. Permanent fetch failures (4xx) are recorded as
   * UNKNOWN + HIGH discrepancy and acknowledged; transient ones throw so MP retries.
   */
  async handleNotification(input: { caseId: string; paymentIdHint?: string | null; eventId: string }) {
    const providerName = this.providerName();
    let fetched: Awaited<ReturnType<NonNullable<PaymentProvider['fetchChargeback']>>> | null = null;
    let fetchError: { status: number; message: string } | null = null;
    if (typeof this.provider.fetchChargeback === 'function') {
      try {
        fetched = await this.provider.fetchChargeback(input.caseId);
      } catch (e: any) {
        financeMetrics.inc('provider_errors');
        fetchError = { status: Number(e?.status || 0), message: String(e?.message || e).slice(0, 300) };
      }
    } else {
      fetchError = { status: 501, message: 'provider has no chargeback API' };
    }

    const externalPaymentId = fetched?.paymentIds?.[0] || input.paymentIdHint || null;
    const payment = externalPaymentId
      ? await this.prisma.payment.findFirst({ where: { externalId: externalPaymentId } })
      : null;

    const row = await this.prisma.chargeback.upsert({
      where: { provider_providerCaseId: { provider: providerName, providerCaseId: input.caseId } },
      create: {
        provider: providerName,
        providerCaseId: input.caseId,
        paymentId: payment?.id ?? null,
        orderId: payment?.orderId ?? null,
        externalPaymentId,
        amount: fetched?.amount ?? null,
        currency: fetched?.currency ?? null,
        reason: fetched?.reason ?? null,
        status: fetched ? (fetched.coverageApplied === true ? 'WON' : 'OPENED') : 'UNKNOWN',
        documentationStatus: fetched?.documentationStatus ?? null,
        coverageApplied: fetched?.coverageApplied ?? null,
        documentationDeadline: fetched?.documentationDeadline ? new Date(fetched.documentationDeadline) : null,
        lastFetchError: fetchError?.message ?? null,
      },
      update: {
        paymentId: payment?.id ?? undefined,
        orderId: payment?.orderId ?? undefined,
        externalPaymentId: externalPaymentId ?? undefined,
        ...(fetched
          ? {
              amount: fetched.amount,
              currency: fetched.currency,
              reason: fetched.reason,
              documentationStatus: fetched.documentationStatus,
              coverageApplied: fetched.coverageApplied,
              documentationDeadline: fetched.documentationDeadline ? new Date(fetched.documentationDeadline) : null,
              lastFetchError: null,
            }
          : { lastFetchError: fetchError?.message ?? null }),
      },
    });
    financeMetrics.inc('chargebacks_opened');
    await this.recorder.auditSafe({
      action: 'chargeback.notification',
      origin: 'webhook',
      orderId: payment?.orderId ?? null,
      paymentId: payment?.id ?? null,
      amount: fetched?.amount ?? null,
      newState: row.status,
      meta: { chargebackId: row.id, caseId: input.caseId, eventId: input.eventId, fetchError: fetchError?.status ?? null },
    });
    await this.recorder.openDiscrepancy(this.prisma, {
      type: fetched ? 'CHARGEBACK_OPEN' : 'CHARGEBACK_FETCH_FAILED',
      severity: 'HIGH',
      dedupeKey: `${fetched ? 'CHARGEBACK_OPEN' : 'CHARGEBACK_FETCH_FAILED'}:${row.id}`,
      message: fetched
        ? `Chargeback ${input.caseId} recebido — prazo de documentação: ${fetched.documentationDeadline ?? 'n/d'}`
        : `Chargeback ${input.caseId} notificado, mas a consulta ao Mercado Pago falhou (${fetchError?.status}). Conferir no painel.`,
      orderId: payment?.orderId ?? null,
      paymentId: payment?.id ?? null,
      externalId: externalPaymentId,
    });

    // Re-sync payment from the payments API (source of truth for money state).
    if (payment?.externalId) {
      try {
        const p = await this.provider.fetchPayment(payment.externalId);
        await this.ensureFromPaymentStatus(payment, p);
        await this.recorder.syncPaymentState(payment.id, {
          source: 'chargeback',
          chargebackId: row.id,
          obs: { rawStatus: p.rawStatus, statusDetail: p.statusDetail, amount: p.amount, refundedAmount: p.refundedAmount },
        });
      } catch (e: any) {
        financeMetrics.inc('provider_errors');
        structuredLog('error', 'CHARGEBACK_PAYMENT_RESYNC_FAILED', { chargebackId: row.id, error: String(e?.message || e).slice(0, 200) });
      }
    }

    if (fetchError && (fetchError.status === 0 || (fetchError.status >= 500 && fetchError.status !== 501))) {
      const err: any = new Error('Falha transitória ao consultar chargeback no Mercado Pago');
      err.status = 502;
      throw err;
    }
    return { chargebackId: row.id, status: row.status, fetched: Boolean(fetched) };
  }
}
