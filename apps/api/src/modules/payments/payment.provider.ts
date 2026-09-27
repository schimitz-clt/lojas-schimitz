/** SCH-003 — contrato do adapter de pagamento (#11). Sem SDK no domínio. */

import { isProdLikeEnv, isRailwayProductionEnv } from '../../common/prod-like-env';
import { isLiveSplitMoneyPathAllowed } from '../marketplace-mp/mp-split-live';
import {
  isLiveAppUsrCredential,
  isSandboxEligibleCredential,
  isSandboxSplitMoneyPathAllowed,
} from '../marketplace-mp/mp-split-sandbox';
import {
  assertLiveApplicationFeeAllowed,
  assertNoLiveMarketplaceSplitFields,
  assertSandboxApplicationFeeAllowed,
} from './mp-split-payment-guard';
import {
  pixFeeFallbackSkipReason,
  shouldRetryPixWithoutApplicationFee,
  type PaymentSplitModeValue,
} from './pix-application-fee-fallback';

export { isProdLikeEnv };

export type DomainPaymentStatus =
  | 'pending'
  | 'approved'
  | 'refused'
  | 'expired'
  | 'cancelled'
  | 'refunded'
  | 'unknown';

export type PaymentMethodMvp = 'pix' | 'card' | 'boleto' | 'wallet';

export type CreateIntentInput = {
  orderId: string;
  publicId: string;
  method: PaymentMethodMvp;
  amount: number;
  payerEmail?: string;
  /** Token do cartão (Checkout Bricks). Nunca PAN/CVV. */
  cardToken?: string;
  installments?: number;
  paymentMethodId?: string;
  /** Segundos até reservationExpiresAt — adapter não deve pedir validade maior. */
  expiresInSeconds?: number;
  /** Idempotency key HTTP do provedor (não misturar com header da loja). */
  providerIdempotencyKey?: string;
  /**
   * Seller OAuth access token for gated split.
   * Sandbox: TEST- always, or APP_USR on a Phase 2 sandbox host.
   * Live (Phase 3): APP_USR only when ENABLED + ALLOW_LIVE + prod-like.
   */
  sellerAccessToken?: string;
  /** Absolute BRL application_fee. Only sent on a gated sandbox or live path. */
  applicationFee?: number;
};

export type CreateIntentResult = {
  externalId: string;
  status: DomainPaymentStatus;
  payload: Record<string, unknown>;
  splitMode?: PaymentSplitModeValue;
  splitFeeSkippedReason?: string | null;
};

export type FetchPaymentResult = {
  externalId: string;
  status: DomainPaymentStatus;
  amount: number;
  externalReference?: string;
  rawStatus?: string;
  /** MP status_detail (e.g. accredited, settled, reimbursed, expired). */
  statusDetail?: string;
  /** MP transaction_amount_refunded (partial/total refunds done anywhere, incl. MP panel). */
  refundedAmount?: number;
  /** MP payment.refunds[] ({id, status, amount}) when present — lets the ledger key refunds by provider refund id. */
  refunds?: ProviderRefund[];
  payload: Record<string, unknown>;
};

/** COMANDO OMEGA — refund with caller-controlled idempotency (partial or total). */
export type CreateRefundInput = {
  /** Omit for a total refund (MP semantics: no amount = full refund). */
  amount?: number;
  /** Sent as X-Idempotency-Key. Same key ⇒ MP returns the same refund (safe retry). */
  idempotencyKey: string;
  accessToken?: string;
};

export type ProviderRefund = {
  refundId: string;
  /** MP refund status: approved | in_process | rejected | cancelled | authorized */
  status: string;
  amount: number;
};

/** Chargeback case as returned by GET /v1/chargebacks/{id} (minimal, no PII). */
export type ProviderChargeback = {
  caseId: string;
  paymentIds: string[];
  amount: number | null;
  currency: string | null;
  reason: string | null;
  coverageApplied: boolean | null;
  documentationStatus: string | null;
  documentationDeadline: string | null;
};

export type RefundResult = {
  externalId: string;
  status: DomainPaymentStatus;
  payload: Record<string, unknown>;
};

export type VerifyWebhookInput = {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: string;
  body: unknown;
  /** Query string of the notification URL (MP sends `data.id` and `type` there). */
  query?: Record<string, unknown>;
};

export type VerifiedWebhookEvent = {
  providerEventId: string;
  topic?: string;
  externalId?: string;
  payload: Record<string, unknown>;
  /** MP notification body.id (same notification ⇒ same id). */
  notificationId?: string;
  action?: string;
  /** Resource id from the notification (payment id, chargeback case id...). */
  dataId?: string;
};

export interface PaymentProvider {
  name: string;
  createIntent(input: CreateIntentInput): Promise<CreateIntentResult>;
  fetchPayment(externalId: string, opts?: { accessToken?: string }): Promise<FetchPaymentResult>;
  cancelIntent(externalId: string, opts?: { accessToken?: string }): Promise<void>;
  refund(externalId: string, amount?: number, opts?: { accessToken?: string }): Promise<RefundResult>;
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent>;
  translateStatus(providerStatus: string): DomainPaymentStatus;
  /** COMANDO OMEGA (optional so existing adapters/test doubles keep compiling). */
  createRefund?(externalId: string, input: CreateRefundInput): Promise<ProviderRefund>;
  listRefunds?(externalId: string, opts?: { accessToken?: string }): Promise<ProviderRefund[]>;
  fetchChargeback?(caseId: string): Promise<ProviderChargeback>;
}

/** Map in-memory para testes do NullPaymentProvider. */
const nullStore = new Map<string, FetchPaymentResult>();
const nullRefunds = new Map<string, Array<{ key: string; refund: ProviderRefund }>>();

export function nullProviderReset() {
  nullStore.clear();
  nullRefunds.clear();
}

export function nullProviderSetStatus(externalId: string, status: DomainPaymentStatus, amount?: number) {
  const cur = nullStore.get(externalId);
  nullStore.set(externalId, {
    externalId,
    status,
    amount: amount ?? cur?.amount ?? 0,
    externalReference: cur?.externalReference,
    rawStatus: status,
    payload: { ...(cur?.payload || {}), simulated: true },
  });
}

export class NullPaymentProvider implements PaymentProvider {
  name = 'null';

  translateStatus(providerStatus: string): DomainPaymentStatus {
    const s = String(providerStatus || '').toLowerCase();
    if (s === 'approved' || s === 'paid') return 'approved';
    if (s === 'rejected' || s === 'refused' || s.startsWith('cc_rejected')) return 'refused';
    if (s === 'cancelled' || s === 'canceled') return 'cancelled';
    if (s === 'expired') return 'expired';
    if (s === 'refunded') return 'refunded';
    if (s === 'charged_back' || s === 'chargeback') return 'unknown';
    if (s === 'pending' || s === 'in_process' || s === 'in_mediation') return 'pending';
    return 'unknown';
  }

  async createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
    const externalId = `null-${input.orderId}-${Date.now()}`;
    const payload: Record<string, unknown> = {
      note: 'NullPaymentProvider — SCH-003 teste',
      method: input.method,
    };
    if (input.method === 'pix') {
      payload.qrCode = `00020126NULLPIX${input.publicId}`;
      payload.qrCodeBase64 = null;
      payload.ticketUrl = null;
    }
    const result: FetchPaymentResult = {
      externalId,
      status: 'pending',
      amount: input.amount,
      externalReference: input.publicId,
      rawStatus: 'pending',
      payload,
    };
    nullStore.set(externalId, result);
    return { externalId, status: 'pending', payload };
  }

  async fetchPayment(externalId: string, _opts?: { accessToken?: string }): Promise<FetchPaymentResult> {
    const hit = nullStore.get(externalId);
    if (hit) return hit;
    return {
      externalId,
      status: 'pending',
      amount: 0,
      rawStatus: 'pending',
      payload: {},
    };
  }

  async cancelIntent(externalId: string, _opts?: { accessToken?: string }): Promise<void> {
    const hit = nullStore.get(externalId);
    if (hit && hit.status === 'pending') {
      nullStore.set(externalId, { ...hit, status: 'cancelled', rawStatus: 'cancelled' });
    }
  }

  async refund(externalId: string, _amount?: number, _opts?: { accessToken?: string }): Promise<RefundResult> {
    const hit = nullStore.get(externalId);
    if (hit) {
      nullStore.set(externalId, { ...hit, status: 'refunded', rawStatus: 'refunded' });
    }
    return {
      externalId,
      status: 'refunded',
      payload: { refunded: true },
    };
  }

  async createRefund(externalId: string, input: CreateRefundInput): Promise<ProviderRefund> {
    const hit = nullStore.get(externalId);
    const prior = nullRefunds.get(externalId) || [];
    const same = prior.find((r) => r.key === input.idempotencyKey);
    if (same) return same.refund;
    const total = hit?.amount ?? 0;
    const already = prior.reduce((s, r) => s + r.refund.amount, 0);
    const amount = input.amount != null ? Number(input.amount) : Math.round((total - already) * 100) / 100;
    const refund: ProviderRefund = { refundId: `null-refund-${prior.length + 1}-${externalId}`, status: 'approved', amount };
    prior.push({ key: input.idempotencyKey, refund });
    nullRefunds.set(externalId, prior);
    if (hit) {
      const refunded = Math.round((already + amount) * 100) / 100;
      nullStore.set(externalId, {
        ...hit,
        refundedAmount: refunded,
        refunds: prior.map((r) => r.refund),
        ...(refunded + 0.009 >= total ? { status: 'refunded' as const, rawStatus: 'refunded' } : {}),
      });
    }
    return refund;
  }

  async listRefunds(externalId: string): Promise<ProviderRefund[]> {
    return (nullRefunds.get(externalId) || []).map((r) => r.refund);
  }

  private webhookSecret(): string {
    const configured =
      process.env.NULL_WEBHOOK_SECRET ||
      process.env.MERCADO_PAGO_WEBHOOK_SECRET ||
      process.env.MP_WEBHOOK_SECRET ||
      '';
    if (isProdLikeEnv()) {
      assertStrongWebhookSecret(configured, 'NullPaymentProvider');
      return configured;
    }
    // Dev/test only: fallback known secret for local harnesses. Never in prod/staging.
    return configured || 'null-test-secret';
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent> {
    const secret = this.webhookSecret();
    // Força secret forte só em prod/staging; em dev o fallback null-test-secret é intencional.
    if (isProdLikeEnv()) {
      assertStrongWebhookSecret(secret, 'NullPaymentProvider');
    }
    const headers = normalizeHeaders(input.headers);
    const sig = headers['x-signature'] || headers['x-null-signature'] || '';
    // Assinatura obrigatória mesmo no provider null (#9).
    if (!sig || (sig !== secret && sig !== `ts=0,v1=${secret}`)) {
      const err: any = new Error('Assinatura de webhook inválida');
      err.status = 401;
      err.code = 'WEBHOOK_SIGNATURE_INVALID';
      throw err;
    }
    const body = (input.body || {}) as Record<string, unknown>;
    const data = (body.data || {}) as Record<string, unknown>;
    const externalId = String(data.id || body.id || body.externalId || '');
    const providerEventId = String(
      body.id || headers['x-request-id'] || `null-evt-${externalId || Date.now()}`,
    );
    if (!providerEventId || providerEventId === 'undefined') {
      const err: any = new Error('Evento de webhook sem identidade');
      err.status = 400;
      err.code = 'WEBHOOK_EVENT_UNPARSEABLE';
      throw err;
    }
    // Simular status via body.status SOMENTE com opt-in explícito e fora de prod (#simulateApprove).
    // Verdade do pagamento continua vindo de fetchPayment no service — body ≠ verdade em MP real.
    if (allowNullPaymentSimulate() && externalId && body.status) {
      const translated = this.translateStatus(String(body.status));
      if (translated !== 'unknown') {
        nullProviderSetStatus(externalId, translated, Number(body.amount) || undefined);
      }
    }
    return {
      providerEventId,
      topic: String(body.type || body.action || 'payment'),
      externalId: externalId || undefined,
      payload: body,
      notificationId: body.id != null ? String(body.id) : undefined,
      action: body.action != null ? String(body.action) : undefined,
      dataId: externalId || undefined,
    };
  }
}

export class MercadoPagoPaymentProvider implements PaymentProvider {
  name = 'mercadopago';
  private readonly baseUrl = resolveMercadoPagoBaseUrl();

  private token() {
    const t = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || '';
    if (!t) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
    }
    return t;
  }

  private webhookSecret() {
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || process.env.MP_WEBHOOK_SECRET || '';
    if (isProdLikeEnv()) {
      assertStrongWebhookSecret(secret, 'MercadoPagoPaymentProvider');
    } else if (secret) {
      // Em dev também recusa secret denylist se configurado (evita deploy acidental fraco).
      if (WEAK_WEBHOOK_SECRETS.has(secret.toLowerCase())) {
        const err: any = new Error('Webhook secret inseguro (denylist)');
        err.status = 401;
        err.code = 'WEBHOOK_SECRET_INSECURE';
        throw err;
      }
    }
    return secret;
  }

  translateStatus(providerStatus: string): DomainPaymentStatus {
    const s = String(providerStatus || '').toLowerCase();
    if (s === 'approved') return 'approved';
    if (s === 'rejected' || s.startsWith('cc_rejected')) return 'refused';
    if (s === 'cancelled' || s === 'canceled') return 'cancelled';
    if (s === 'expired') return 'expired';
    if (s === 'refunded') return 'refunded';
    if (s === 'charged_back') return 'unknown';
    if (s === 'pending' || s === 'in_process' || s === 'in_mediation' || s === 'authorized') return 'pending';
    return 'unknown';
  }

  private async mpFetch(
    path: string,
    init: RequestInit & { idempotencyKey?: string; accessToken?: string } = {},
  ) {
    const bearer = init.accessToken || this.token();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };
    if (init.idempotencyKey) headers['X-Idempotency-Key'] = init.idempotencyKey;
    assertNotRealMercadoPagoInTests(this.baseUrl);
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const text = await res.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      const err: any = new Error(json.message || `Mercado Pago HTTP ${res.status}`);
      err.status = res.status;
      err.payload = json;
      throw err;
    }
    return json;
  }

  async createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
    if (input.method !== 'pix' && input.method !== 'card') {
      const err: any = new Error('METHOD_NOT_AVAILABLE');
      err.code = 'METHOD_NOT_AVAILABLE';
      throw err;
    }

    const body: Record<string, unknown> = {
      transaction_amount: Number(input.amount),
      description: `Pedido ${input.publicId}`,
      external_reference: input.publicId,
      payer: { email: String(input.payerEmail || '').trim() },
    };

    // Webhook de produção (Railway). Sem isso o MP não notifica a loja.
    // PUBLIC_API_URL often already includes API_PREFIX (see docs/DEPLOY.md) —
    // do not append prefix twice (…/api/v1/api/v1/webhooks/… → 404).
    const notificationUrl = buildMercadoPagoNotificationUrl(
      process.env.PUBLIC_API_URL || '',
      process.env.API_PREFIX || 'api/v1',
    );
    if (notificationUrl) {
      body.notification_url = notificationUrl;
    }

    if (input.method === 'pix') {
      body.payment_method_id = 'pix';
      if (input.expiresInSeconds && input.expiresInSeconds > 0) {
        // MP exige yyyy-MM-dd'T'HH:mm:ss.SSSZ com offset (ex: -03:00). ISO com Z puro → HTTP 400.
        const exp = new Date(Date.now() + input.expiresInSeconds * 1000);
        const pad = (n: number, l = 2) => String(n).padStart(l, '0');
        // America/Sao_Paulo ≈ UTC-3 (sem DST desde 2019)
        const sp = new Date(exp.getTime() - 3 * 60 * 60 * 1000);
        body.date_of_expiration =
          `${sp.getUTCFullYear()}-${pad(sp.getUTCMonth() + 1)}-${pad(sp.getUTCDate())}` +
          `T${pad(sp.getUTCHours())}:${pad(sp.getUTCMinutes())}:${pad(sp.getUTCSeconds())}.000-03:00`;
      }
    } else {
      if (!input.cardToken) {
        const err: any = new Error('cardToken obrigatório para método card');
        err.code = 'CARD_TOKEN_REQUIRED';
        throw err;
      }
      body.token = input.cardToken;
      body.installments = input.installments || 1;
      if (input.paymentMethodId) body.payment_method_id = input.paymentMethodId;
    }

    const sellerToken = String(input.sellerAccessToken || '').trim();
    const fee =
      input.applicationFee != null && Number.isFinite(Number(input.applicationFee))
        ? Number(input.applicationFee)
        : null;
    const wantsSplit = Boolean(sellerToken && fee != null && fee > 0);
    let useSandboxSplit = false;
    let useLiveSplit = false;

    if (wantsSplit) {
      const sandboxOk =
        isSandboxEligibleCredential(sellerToken) && isSandboxSplitMoneyPathAllowed();
      const liveOk = isLiveAppUsrCredential(sellerToken) && isLiveSplitMoneyPathAllowed();
      if (sandboxOk) {
        useSandboxSplit = true;
        body.application_fee = fee;
        assertSandboxApplicationFeeAllowed(body);
      } else if (liveOk) {
        useLiveSplit = true;
        body.application_fee = fee;
        assertLiveApplicationFeeAllowed(body);
      } else {
        const err: Error & { code?: string } = new Error(
          isLiveAppUsrCredential(sellerToken)
            ? 'Token de vendedor live (APP_USR) bloqueado: split live exige ENABLED + ALLOW_LIVE + produção + APP_USR.'
            : 'Token de vendedor bloqueado no split sandbox (Fase 2).',
        );
        err.code = 'PHASE2_SPLIT_FORBIDDEN';
        throw err;
      }
    } else {
      // Platform collector: no application_fee unless a gated path assigned it.
      assertNoLiveMarketplaceSplitFields(body);
    }

    const useSellerSplit = useSandboxSplit || useLiveSplit;
    // Validated last so split/credential guards keep their own error codes.
    requireMercadoPagoPayerEmail(input.payerEmail);
    const idempotencyKey = input.providerIdempotencyKey || `sch-intent-${input.orderId}-${input.method}`;
    let json: any;
    let splitMode: PaymentSplitModeValue = useSellerSplit ? 'seller_oauth_v1' : 'off';
    let splitFeeSkippedReason: string | null = null;
    try {
      json = await this.mpFetch('/v1/payments', {
        method: 'POST',
        body: JSON.stringify(body),
        idempotencyKey,
        accessToken: useSellerSplit ? sellerToken : undefined,
      });
    } catch (e: unknown) {
      if (
        !shouldRetryPixWithoutApplicationFee({
          method: input.method,
          usedSandboxSplit: useSandboxSplit,
          usedLiveSplit: useLiveSplit,
          err: e,
        })
      ) {
        throw e;
      }
      // One retry: no application_fee, platform collector. Honest ledger_only —
      // not a silent 100% take. Live PIX may not auto-split cash at MP.
      const retryBody = { ...body };
      delete retryBody.application_fee;
      assertNoLiveMarketplaceSplitFields(retryBody);
      json = await this.mpFetch('/v1/payments', {
        method: 'POST',
        body: JSON.stringify(retryBody),
        idempotencyKey: `${idempotencyKey}-nfee`,
      });
      splitMode = 'ledger_only';
      splitFeeSkippedReason = pixFeeFallbackSkipReason(e);
    }

    const status = this.translateStatus(String(json.status || 'pending'));
    const poi = json.point_of_interaction?.transaction_data || {};
    const payload: Record<string, unknown> = {
      mpStatus: json.status,
      qrCode: poi.qr_code || null,
      qrCodeBase64: poi.qr_code_base64 || null,
      ticketUrl: poi.ticket_url || null,
      paymentMethodId: json.payment_method_id,
      splitMode,
      splitFeeSkippedReason,
    };
    if (splitMode === 'ledger_only' && fee != null) {
      payload.expectedApplicationFee = fee;
    }

    return {
      externalId: String(json.id),
      status,
      payload,
      splitMode,
      splitFeeSkippedReason,
    };
  }

  async fetchPayment(externalId: string, opts?: { accessToken?: string }): Promise<FetchPaymentResult> {
    const json = await this.mpFetch(`/v1/payments/${encodeURIComponent(externalId)}`, {
      accessToken: opts?.accessToken,
    });
    const status = this.translateStatus(String(json.status || ''));
    const poi = json.point_of_interaction?.transaction_data || {};
    return {
      externalId: String(json.id),
      status,
      amount: Number(json.transaction_amount || 0),
      externalReference: json.external_reference ? String(json.external_reference) : undefined,
      rawStatus: String(json.status || ''),
      statusDetail: json.status_detail != null ? String(json.status_detail) : undefined,
      refundedAmount:
        json.transaction_amount_refunded != null ? Number(json.transaction_amount_refunded) : undefined,
      refunds: Array.isArray(json.refunds) ? mapMercadoPagoRefunds(json.refunds) : undefined,
      payload: {
        mpStatus: json.status,
        statusDetail: json.status_detail,
        qrCode: poi.qr_code || null,
        qrCodeBase64: poi.qr_code_base64 || null,
        ticketUrl: poi.ticket_url || null,
      },
    };
  }

  async cancelIntent(externalId: string, opts?: { accessToken?: string }): Promise<void> {
    try {
      await this.mpFetch(`/v1/payments/${encodeURIComponent(externalId)}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled' }),
        accessToken: opts?.accessToken,
      });
    } catch {
      // best-effort (#7/#12)
    }
  }

  async refund(externalId: string, amount?: number, opts?: { accessToken?: string }): Promise<RefundResult> {
    const body = amount != null ? { amount } : {};
    const json = await this.mpFetch(`/v1/payments/${encodeURIComponent(externalId)}/refunds`, {
      method: 'POST',
      body: JSON.stringify(body),
      idempotencyKey: `sch-refund-${externalId}`,
      accessToken: opts?.accessToken,
    });
    // Reconsulta para status definitivo
    let status: DomainPaymentStatus = 'refunded';
    try {
      const fetched = await this.fetchPayment(externalId, opts);
      status = fetched.status === 'refunded' ? 'refunded' : this.translateStatus(String(json.status || 'refunded'));
    } catch {
      status = 'refunded';
    }
    return { externalId, status, payload: json as Record<string, unknown> };
  }

  /**
   * POST /v1/payments/{id}/refunds with a caller-controlled X-Idempotency-Key
   * (MP docs: amount present ⇒ partial, absent ⇒ total; same key ⇒ same refund).
   */
  async createRefund(externalId: string, input: CreateRefundInput): Promise<ProviderRefund> {
    const body = input.amount != null ? { amount: Number(input.amount) } : {};
    const json = await this.mpFetch(`/v1/payments/${encodeURIComponent(externalId)}/refunds`, {
      method: 'POST',
      body: JSON.stringify(body),
      idempotencyKey: input.idempotencyKey,
      accessToken: input.accessToken,
    });
    return {
      refundId: String(json.id ?? ''),
      status: String(json.status || 'unknown'),
      amount: Number(json.amount ?? input.amount ?? 0),
    };
  }

  /**
   * GET /v1/payments/{id}/refunds. Observed against the real MP sandbox (2026-09-26): this route
   * answered HTTP 405 with an empty body, while GET /v1/payments/{id} carries the same refunds in
   * `refunds[]` ({id, status, amount}). On 404/405 we fall back to the payment resource instead of
   * failing the refund refresh.
   */
  async listRefunds(externalId: string, opts?: { accessToken?: string }): Promise<ProviderRefund[]> {
    const id = encodeURIComponent(externalId);
    let rows: any[];
    try {
      const json = await this.mpFetch(`/v1/payments/${id}/refunds`, { accessToken: opts?.accessToken });
      rows = Array.isArray(json) ? json : Array.isArray(json?.results) ? json.results : [];
    } catch (e: any) {
      if (e?.status !== 404 && e?.status !== 405) throw e;
      const pay = await this.mpFetch(`/v1/payments/${id}`, { accessToken: opts?.accessToken });
      rows = Array.isArray(pay?.refunds) ? pay.refunds : [];
    }
    return mapMercadoPagoRefunds(rows);
  }

  /**
   * GET /v1/chargebacks/{id}. MP docs require X-Caller-Id (seller id) on this endpoint;
   * configured via MERCADO_PAGO_USER_ID. Without it the call is attempted without the header
   * and failures are surfaced (never simulated).
   */
  async fetchChargeback(caseId: string): Promise<ProviderChargeback> {
    const callerId = String(process.env.MERCADO_PAGO_USER_ID || '').trim();
    const json = await this.mpFetch(`/v1/chargebacks/${encodeURIComponent(caseId)}`, {
      headers: callerId ? { 'X-Caller-Id': callerId } : undefined,
    });
    const pays = Array.isArray(json.payments) ? json.payments : json.payments != null ? [json.payments] : [];
    return {
      caseId: String(json.id ?? caseId),
      paymentIds: pays.map((x: any) => String(typeof x === 'object' && x ? x.id ?? '' : x)).filter(Boolean),
      amount: json.amount != null ? Number(json.amount) : null,
      currency: json.currency != null ? String(json.currency) : null,
      reason: json.reason != null ? String(json.reason) : null,
      coverageApplied: typeof json.coverage_applied === 'boolean' ? json.coverage_applied : json.coverage_applied === 'true' ? true : json.coverage_applied === 'false' ? false : null,
      documentationStatus: json.documentation_status != null ? String(json.documentation_status) : null,
      documentationDeadline: json.date_documentation_deadline != null ? String(json.date_documentation_deadline) : null,
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent> {
    const headers = normalizeHeaders(input.headers);
    const secret = this.webhookSecret();
    const xSignature = headers['x-signature'] || '';
    const xRequestId = headers['x-request-id'] || '';

    if (!secret) {
      const err: any = new Error('Webhook secret não configurado');
      err.status = 401;
      err.code = 'WEBHOOK_SIGNATURE_INVALID';
      throw err;
    }

    if (!xSignature) {
      const err: any = new Error('Assinatura ausente');
      err.status = 401;
      err.code = 'WEBHOOK_SIGNATURE_INVALID';
      throw err;
    }

    const parts = Object.fromEntries(
      xSignature.split(',').map((p) => {
        const [k, v] = p.split('=').map((s) => s.trim());
        return [k, v];
      }),
    );
    const ts = parts.ts || '';
    const v1 = parts.v1 || '';

    const body = (input.body || {}) as Record<string, unknown>;
    const data = (body.data || {}) as Record<string, unknown>;
    // MP docs: the signed id is `data.id` from the notification URL query string; body data.id
    // carries the same value for payment topics. Prefer query, fall back to body (legacy behaviour).
    const queryDataId = pickQueryDataId(input.query);
    const dataId = String(queryDataId || data.id || body.data_id || '');

    // Manifesto oficial MP: id:[data.id_url];request-id:[x-request-id];ts:[ts];
    const crypto = await import('crypto');
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

    if (!v1 || !timingSafeEqualHex(v1, expected)) {
      // Fallbacks: lower-cased id (older SDKs) and the documented "omit absent pairs" manifest.
      const candidates = [
        `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`,
        buildMercadoPagoSignatureManifest({ dataId, requestId: xRequestId, ts }),
      ];
      const ok = candidates.some((m) =>
        timingSafeEqualHex(v1, crypto.createHmac('sha256', secret).update(m).digest('hex')),
      );
      if (!ok) {
        const err: any = new Error('Assinatura de webhook inválida');
        err.status = 401;
        err.code = 'WEBHOOK_SIGNATURE_INVALID';
        throw err;
      }
    }

    const providerEventId = xRequestId || String(body.id || '') || `${dataId}:${ts}`;
    if (!providerEventId || !dataId) {
      // Sem identidade parseável útil
      if (!providerEventId) {
        const err: any = new Error('Evento de webhook sem identidade');
        err.status = 400;
        err.code = 'WEBHOOK_EVENT_UNPARSEABLE';
        throw err;
      }
    }

    return {
      providerEventId,
      topic: String(body.type || pickQueryString(input.query, 'type') || body.action || 'payment'),
      externalId: dataId || undefined,
      payload: body,
      notificationId: body.id != null ? String(body.id) : undefined,
      action: body.action != null ? String(body.action) : undefined,
      dataId: dataId || undefined,
    };
  }
}

const OFFICIAL_MP_BASE_URL = 'https://api.mercadopago.com';

/**
 * Base URL for the Mercado Pago REST API. MERCADO_PAGO_API_BASE_URL exists ONLY so local tests can
 * point the real adapter at a local fake server (labelled TEST). It is ignored in production/staging.
 */
export function resolveMercadoPagoBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const override = String(env.MERCADO_PAGO_API_BASE_URL || '').trim().replace(/\/$/, '');
  if (!override) return OFFICIAL_MP_BASE_URL;
  if (isProdLikeEnv(env)) return OFFICIAL_MP_BASE_URL;
  return override;
}

/** Test harness guard: FINANCE_TEST_MODE=true must never reach the real Mercado Pago host. */
export function assertNotRealMercadoPagoInTests(baseUrl: string, env: NodeJS.ProcessEnv = process.env) {
  if (String(env.FINANCE_TEST_MODE || '') !== 'true') return;
  if (/mercadopago\.com/i.test(baseUrl)) {
    const err: any = new Error('FINANCE_TEST_MODE: chamada ao Mercado Pago real bloqueada em teste');
    err.code = 'REAL_PROVIDER_BLOCKED_IN_TEST';
    throw err;
  }
}

/** Normalises MP refund rows (list endpoint or payment.refunds[]). */
export function mapMercadoPagoRefunds(rows: any[]): ProviderRefund[] {
  return rows.map((r) => ({ refundId: String(r?.id ?? ''), status: String(r?.status || 'unknown'), amount: Number(r?.amount || 0) }));
}

/**
 * MP requires a syntactically valid payer.email (sandbox 2026-09-26: `cliente@lojas-schimitz.test`
 * → HTTP 400 "payer.email must be a valid email"). The old hard-coded fallback could never succeed,
 * so a missing/malformed e-mail now fails locally with a clear code instead of a doomed MP call.
 */
export function requireMercadoPagoPayerEmail(email?: string | null): string {
  const e = String(email || '').trim();
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e)) {
    const err: Error & { code?: string } = new Error('E-mail do pagador ausente ou inválido para o Mercado Pago');
    err.code = 'PAYER_EMAIL_INVALID';
    throw err;
  }
  return e;
}

/** Documented manifest: pairs whose value is absent are omitted. */
export function buildMercadoPagoSignatureManifest(input: { dataId?: string; requestId?: string; ts?: string }) {
  let m = '';
  if (input.dataId) m += `id:${input.dataId};`;
  if (input.requestId) m += `request-id:${input.requestId};`;
  if (input.ts) m += `ts:${input.ts};`;
  return m;
}

function pickQueryString(query: Record<string, unknown> | undefined, key: string): string {
  if (!query) return '';
  const v = query[key];
  if (Array.isArray(v)) return String(v[0] ?? '');
  return v == null ? '' : String(v);
}

function pickQueryDataId(query: Record<string, unknown> | undefined): string {
  if (!query) return '';
  const flat = pickQueryString(query, 'data.id');
  if (flat) return flat;
  const nested = query.data as Record<string, unknown> | undefined;
  if (nested && typeof nested === 'object' && nested.id != null) return String(nested.id);
  return '';
}


const WEAK_WEBHOOK_SECRETS = new Set([
  '',
  'null-test-secret',
  'secret',
  'test',
  'changeme',
  'change-me',
  'webhook',
  'webhook-secret',
  'mp-webhook',
]);


/**
 * Builds MP notification_url without doubling API_PREFIX when PUBLIC_API_URL
 * already ends with it (DEPLOY.md: …/api/v1).
 */
export function buildMercadoPagoNotificationUrl(
  publicApiUrl: string,
  apiPrefix = 'api/v1',
): string | null {
  const base = String(publicApiUrl || '').trim().replace(/\/$/, '');
  if (!base) return null;
  const prefix = String(apiPrefix || 'api/v1').replace(/^\//, '').replace(/\/$/, '');
  const withPrefix =
    base === prefix || base.endsWith(`/${prefix}`) ? base : `${base}/${prefix}`;
  return `${withPrefix}/webhooks/mercadopago`;
}

/** Opt-in explícito para body.status no NullPaymentProvider (nunca em prod/staging/Railway prod). */
export function allowNullPaymentSimulate() {
  if (isProdLikeEnv()) return false;
  // Browser-public flags must never enable API simulate (even in dev they are ignored).
  return process.env.ALLOW_NULL_PAYMENT_SIMULATE === 'true';
}

export function assertStrongWebhookSecret(secret: string, context: string) {
  const s = String(secret || '');
  const weak = !s || s.length < 16 || WEAK_WEBHOOK_SECRETS.has(s.toLowerCase());
  if (weak) {
    const err: any = new Error(
      `Webhook secret ausente/inseguro (${context}). Configure MERCADO_PAGO_WEBHOOK_SECRET com valor forte (≥16 chars).`,
    );
    err.status = 401;
    err.code = 'WEBHOOK_SECRET_INSECURE';
    throw err;
  }
}

function normalizeHeaders(headers: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[k.toLowerCase()] = Array.isArray(v) ? String(v[0] || '') : String(v || '');
  }
  return out;
}

function timingSafeEqualHex(a: string, b: string) {
  try {
    const { timingSafeEqual } = require('crypto') as typeof import('crypto');
    const ba = Buffer.from(String(a), 'utf8');
    const bb = Buffer.from(String(b), 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return a === b;
  }
}

export function createPaymentProviderFromEnv(): PaymentProvider {
  const mode = (process.env.PAYMENTS_PROVIDER || 'null').toLowerCase();
  if (mode === 'mercadopago' || mode === 'mp') {
    return new MercadoPagoPaymentProvider();
  }
  if (isRailwayProductionEnv()) {
    // Override ALLOW_NULL_PROVIDER_IN_PROD is ignored on Railway production (F14).
    throw new Error(
      'PAYMENTS_PROVIDER=null proibido em Railway production (ALLOW_NULL_PROVIDER_IN_PROD ignorado). Configure mercadopago + secrets.',
    );
  }
  if (isProdLikeEnv() && process.env.ALLOW_NULL_PROVIDER_IN_PROD !== 'true') {
    // Não sobe provider null em prod/staging sem override explícito (evita simulateApprove público).
    throw new Error(
      'PAYMENTS_PROVIDER=null proibido em production/staging sem ALLOW_NULL_PROVIDER_IN_PROD=true. Configure mercadopago + secrets.',
    );
  }
  return new NullPaymentProvider();
}
