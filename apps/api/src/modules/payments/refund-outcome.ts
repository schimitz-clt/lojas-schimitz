/**
 * Legacy admin refund (POST /admin/payments/:id/refund) — how to read a Mercado Pago failure.
 *
 * Incident 09/10/2026 (pedido SCH-MV0VVAOC-0183DE): the MP call took ~10 s and failed on our side,
 * the refund was done at MP anyway, and the raw error became HTTP 500. Rule now: a provider error is
 * only a definitive "no" for a clear 4xx; anything else (timeout, network, 5xx, 408/409/429) is
 * UNCERTAIN → re-read the payment at MP before answering, never a raw 500.
 */
export type ProviderRefundErrorClass = 'rejected' | 'uncertain';

const UNCERTAIN_4XX = new Set([408, 409, 425, 429]);

export function classifyProviderRefundError(e: unknown): ProviderRefundErrorClass {
  const status = Number((e as { status?: unknown } | null)?.status || 0);
  if (status >= 400 && status < 500 && !UNCERTAIN_4XX.has(status)) return 'rejected';
  return 'uncertain';
}

/** Error class for logs (no message bodies, no tokens). */
export function providerErrorKind(e: unknown): string {
  const err = e as { status?: unknown; name?: unknown; cause?: { code?: unknown } } | null;
  const status = Number(err?.status || 0);
  if (status) return `http_${status}`;
  const name = String(err?.name || '');
  if (name === 'TimeoutError' || name === 'AbortError') return 'timeout';
  const code = String(err?.cause?.code || '');
  return code ? `network_${code}` : 'network';
}

export const REFUND_PROCESSING_MESSAGE =
  'Estorno em processamento no Mercado Pago. Confirme em instantes (atualize o pedido). ' +
  'Pode clicar de novo com segurança: o mesmo estorno nunca é feito duas vezes.';

export function refundRejectedMessage(detail?: string | null): string {
  const d = String(detail || '').trim().slice(0, 160);
  return `O Mercado Pago recusou o estorno${d ? ` (${d})` : ''}. Nada foi devolvido; confira o pagamento no painel do Mercado Pago.`;
}

/** Stable per payment: a repeated click / retry is the SAME refund at MP (X-Idempotency-Key). */
export function legacyRefundIdempotencyKey(externalId: string): string {
  return `sch-refund-${externalId}`;
}
