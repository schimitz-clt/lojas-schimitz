import { opsSignals } from '../../common/sliding-window';
import {
  assertNotRealMercadoPagoInTests,
  resolveMercadoPagoBaseUrl,
} from '../payments/payment.provider';

/**
 * H4 — public, non-sensitive payments health for uptime monitors (UptimeRobot/Better Stack/own cron).
 * 200 = ok, 503 = down. Never returns tokens, amounts, customer data or provider error bodies.
 *
 * "down" when: provider not configured, OR Mercado Pago rejects/does not answer a READ-ONLY call
 * (GET /v1/payment_methods — no charge, no write), OR too many provider errors in the last 15 min.
 */

export type ProviderPing = {
  reachable: boolean;
  httpStatus: number | null;
  checkedAt: string;
  latencyMs: number;
  reason?: 'unauthorized' | 'http_error' | 'timeout_or_network' | 'blocked_in_test';
};

export type PaymentsHealth = {
  service: 'lojas-schimitz-api';
  status: 'ok' | 'down';
  provider: string;
  reasons: string[];
  checks: {
    configured: boolean;
    providerReachable: boolean | null;
    providerHttpStatus: number | null;
    providerCheckedAt: string | null;
    providerLatencyMs: number | null;
  };
  recent15m: {
    providerErrors: number;
    webhookFailures: number;
    /** Subset of webhookFailures: chargeback / provider fetch / apply failures (what the ops alert watches). */
    webhookProcessingFailures: number;
    paymentsFailed: number;
    paymentsPaid: number;
  };
  time: string;
};

const WINDOW = 15 * 60_000;

export function paymentsProviderMode(env: NodeJS.ProcessEnv = process.env): string {
  const m = String(env.PAYMENTS_PROVIDER || 'null').toLowerCase();
  return m === 'mp' ? 'mercadopago' : m;
}

function mpToken(env: NodeJS.ProcessEnv): string {
  return String(env.MERCADO_PAGO_ACCESS_TOKEN || env.MP_ACCESS_TOKEN || '').trim();
}

/** READ-ONLY reachability/auth check against Mercado Pago. Never throws. */
export async function pingMercadoPago(
  env: NodeJS.ProcessEnv = process.env,
  timeoutMs = 5000,
): Promise<ProviderPing> {
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  const base = resolveMercadoPagoBaseUrl(env);
  try {
    assertNotRealMercadoPagoInTests(base, env);
  } catch {
    return { reachable: false, httpStatus: null, checkedAt, latencyMs: 0, reason: 'blocked_in_test' };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/v1/payment_methods`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${mpToken(env)}` },
      signal: ctrl.signal,
    });
    // drain body without keeping it (may be large; never logged)
    await res.arrayBuffer().catch(() => undefined);
    const latencyMs = Date.now() - started;
    if (res.ok) return { reachable: true, httpStatus: res.status, checkedAt, latencyMs };
    return {
      reachable: false,
      httpStatus: res.status,
      checkedAt,
      latencyMs,
      reason: res.status === 401 || res.status === 403 ? 'unauthorized' : 'http_error',
    };
  } catch {
    return {
      reachable: false,
      httpStatus: null,
      checkedAt,
      latencyMs: Date.now() - started,
      reason: 'timeout_or_network',
    };
  } finally {
    clearTimeout(t);
  }
}

export function evaluatePaymentsHealth(input: {
  provider: string;
  configured: boolean;
  ping: ProviderPing | null;
  recent: PaymentsHealth['recent15m'];
  maxProviderErrors: number;
  now?: Date;
}): PaymentsHealth {
  const reasons: string[] = [];
  const isNull = input.provider === 'null';
  if (!isNull && !input.configured) reasons.push('provider_not_configured');
  if (!isNull && input.ping && !input.ping.reachable) reasons.push(`provider_${input.ping.reason || 'unreachable'}`);
  if (input.recent.providerErrors >= input.maxProviderErrors) reasons.push('provider_errors_burst');
  return {
    service: 'lojas-schimitz-api',
    status: reasons.length ? 'down' : 'ok',
    provider: input.provider,
    reasons,
    checks: {
      configured: input.configured,
      providerReachable: input.ping ? input.ping.reachable : null,
      providerHttpStatus: input.ping ? input.ping.httpStatus : null,
      providerCheckedAt: input.ping ? input.ping.checkedAt : null,
      providerLatencyMs: input.ping ? input.ping.latencyMs : null,
    },
    recent15m: input.recent,
    time: (input.now || new Date()).toISOString(),
  };
}

export function recentPaymentSignals(now = Date.now()): PaymentsHealth['recent15m'] {
  return {
    providerErrors: opsSignals.count('provider_errors', WINDOW, now),
    webhookFailures: opsSignals.count('webhook_failures', WINDOW, now),
    webhookProcessingFailures: opsSignals.count('webhook_processing_failures', WINDOW, now),
    paymentsFailed: opsSignals.count('payments_failed', WINDOW, now),
    paymentsPaid: opsSignals.count('payments_paid', WINDOW, now),
  };
}

/**
 * Corpo público de `/health/payments`. Em produção/staging os contadores `recent15m`
 * (pagos/falhos/webhooks nos últimos 15 min) não saem no endpoint público: revelariam
 * volume de vendas a qualquer pessoa. O status/`reasons` continuam (o monitor de uptime só
 * precisa do 200/503) e os números ficam no admin autenticado (`GET /admin/finance/health`).
 */
export type PublicPaymentsHealth = Omit<PaymentsHealth, 'recent15m'> & { recent15m?: PaymentsHealth['recent15m'] };

export function publicPaymentsHealth(h: PaymentsHealth, prodLike: boolean): PublicPaymentsHealth {
  if (!prodLike) return h;
  const { recent15m: _hidden, ...rest } = h;
  return rest;
}

/**
 * Caches the provider ping (default 5 min) so a public endpoint polled by monitors
 * cannot be used to hammer Mercado Pago. Concurrent callers share one in-flight ping.
 */
export class PaymentsHealthChecker {
  private cached: ProviderPing | null = null;
  private inflight: Promise<ProviderPing> | null = null;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  private ttlMs() {
    const n = Number.parseInt(String(this.env.PAYMENTS_HEALTH_PING_TTL_SECONDS ?? ''), 10);
    return (Number.isFinite(n) && n >= 30 ? Math.min(n, 3600) : 300) * 1000;
  }

  private maxProviderErrors() {
    const n = Number.parseInt(String(this.env.PAYMENTS_HEALTH_MAX_PROVIDER_ERRORS ?? ''), 10);
    return Number.isFinite(n) && n >= 1 ? n : 5;
  }

  async check(now = new Date()): Promise<PaymentsHealth> {
    const provider = paymentsProviderMode(this.env);
    const configured = provider === 'mercadopago' ? Boolean(mpToken(this.env)) : provider === 'null';
    let ping: ProviderPing | null = null;
    if (provider === 'mercadopago' && configured) {
      const fresh = this.cached && now.getTime() - Date.parse(this.cached.checkedAt) < this.ttlMs();
      if (fresh) ping = this.cached;
      else {
        if (!this.inflight) {
          this.inflight = pingMercadoPago(this.env).finally(() => {
            this.inflight = null;
          });
        }
        ping = await this.inflight;
        this.cached = ping;
      }
    }
    return evaluatePaymentsHealth({
      provider,
      configured,
      ping,
      recent: recentPaymentSignals(now.getTime()),
      maxProviderErrors: this.maxProviderErrors(),
      now,
    });
  }
}
