/** SCH-003 — contrato do adapter de pagamento (#11). Sem SDK no domínio. */

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
};

export type CreateIntentResult = {
  externalId: string;
  status: DomainPaymentStatus;
  payload: Record<string, unknown>;
};

export type FetchPaymentResult = {
  externalId: string;
  status: DomainPaymentStatus;
  amount: number;
  externalReference?: string;
  rawStatus?: string;
  payload: Record<string, unknown>;
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
};

export type VerifiedWebhookEvent = {
  providerEventId: string;
  topic?: string;
  externalId?: string;
  payload: Record<string, unknown>;
};

export interface PaymentProvider {
  name: string;
  createIntent(input: CreateIntentInput): Promise<CreateIntentResult>;
  fetchPayment(externalId: string): Promise<FetchPaymentResult>;
  cancelIntent(externalId: string): Promise<void>;
  refund(externalId: string, amount?: number): Promise<RefundResult>;
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent>;
  translateStatus(providerStatus: string): DomainPaymentStatus;
}

/** Map in-memory para testes do NullPaymentProvider. */
const nullStore = new Map<string, FetchPaymentResult>();

export function nullProviderReset() {
  nullStore.clear();
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

  async fetchPayment(externalId: string): Promise<FetchPaymentResult> {
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

  async cancelIntent(externalId: string): Promise<void> {
    const hit = nullStore.get(externalId);
    if (hit && hit.status === 'pending') {
      nullStore.set(externalId, { ...hit, status: 'cancelled', rawStatus: 'cancelled' });
    }
  }

  async refund(externalId: string, _amount?: number): Promise<RefundResult> {
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
    };
  }
}

export class MercadoPagoPaymentProvider implements PaymentProvider {
  name = 'mercadopago';
  private readonly baseUrl = 'https://api.mercadopago.com';

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

  private async mpFetch(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token()}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };
    if (init.idempotencyKey) headers['X-Idempotency-Key'] = init.idempotencyKey;
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
      payer: { email: input.payerEmail || 'cliente@lojas-schimitz.test' },
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

    const json = await this.mpFetch('/v1/payments', {
      method: 'POST',
      body: JSON.stringify(body),
      idempotencyKey: input.providerIdempotencyKey || `sch-intent-${input.orderId}-${input.method}`,
    });

    const status = this.translateStatus(String(json.status || 'pending'));
    const poi = json.point_of_interaction?.transaction_data || {};
    const payload: Record<string, unknown> = {
      mpStatus: json.status,
      qrCode: poi.qr_code || null,
      qrCodeBase64: poi.qr_code_base64 || null,
      ticketUrl: poi.ticket_url || null,
      paymentMethodId: json.payment_method_id,
    };

    return {
      externalId: String(json.id),
      status,
      payload,
    };
  }

  async fetchPayment(externalId: string): Promise<FetchPaymentResult> {
    const json = await this.mpFetch(`/v1/payments/${encodeURIComponent(externalId)}`);
    const status = this.translateStatus(String(json.status || ''));
    const poi = json.point_of_interaction?.transaction_data || {};
    return {
      externalId: String(json.id),
      status,
      amount: Number(json.transaction_amount || 0),
      externalReference: json.external_reference ? String(json.external_reference) : undefined,
      rawStatus: String(json.status || ''),
      payload: {
        mpStatus: json.status,
        statusDetail: json.status_detail,
        qrCode: poi.qr_code || null,
        qrCodeBase64: poi.qr_code_base64 || null,
        ticketUrl: poi.ticket_url || null,
      },
    };
  }

  async cancelIntent(externalId: string): Promise<void> {
    try {
      await this.mpFetch(`/v1/payments/${encodeURIComponent(externalId)}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled' }),
      });
    } catch {
      // best-effort (#7/#12)
    }
  }

  async refund(externalId: string, amount?: number): Promise<RefundResult> {
    const body = amount != null ? { amount } : {};
    const json = await this.mpFetch(`/v1/payments/${encodeURIComponent(externalId)}/refunds`, {
      method: 'POST',
      body: JSON.stringify(body),
      idempotencyKey: `sch-refund-${externalId}`,
    });
    // Reconsulta para status definitivo
    let status: DomainPaymentStatus = 'refunded';
    try {
      const fetched = await this.fetchPayment(externalId);
      status = fetched.status === 'refunded' ? 'refunded' : this.translateStatus(String(json.status || 'refunded'));
    } catch {
      status = 'refunded';
    }
    return { externalId, status, payload: json as Record<string, unknown> };
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
    const dataId = String(data.id || body.data_id || '');

    // Manifesto oficial MP: id:[data.id_url];request-id:[x-request-id];ts:[ts];
    const crypto = await import('crypto');
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

    if (!v1 || !timingSafeEqualHex(v1, expected)) {
      // Fallback: alguns ambientes usam id em minúsculas na query
      const manifestAlt = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;
      const expectedAlt = crypto.createHmac('sha256', secret).update(manifestAlt).digest('hex');
      if (!timingSafeEqualHex(v1, expectedAlt)) {
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
      topic: String(body.type || body.action || 'payment'),
      externalId: dataId || undefined,
      payload: body,
    };
  }
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

export function isProdLikeEnv() {
  const env = String(process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
  return env === 'production' || env === 'prod' || env === 'staging';
}

/** Opt-in explícito para body.status no NullPaymentProvider (nunca em prod/staging). */
export function allowNullPaymentSimulate() {
  if (isProdLikeEnv()) return false;
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
  if (isProdLikeEnv() && process.env.ALLOW_NULL_PROVIDER_IN_PROD !== 'true') {
    // Não sobe provider null em prod/staging sem override explícito (evita simulateApprove público).
    throw new Error(
      'PAYMENTS_PROVIDER=null proibido em production/staging sem ALLOW_NULL_PROVIDER_IN_PROD=true. Configure mercadopago + secrets.',
    );
  }
  return new NullPaymentProvider();
}
