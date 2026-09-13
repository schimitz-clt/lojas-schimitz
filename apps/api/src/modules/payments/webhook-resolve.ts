/**
 * Deterministic webhook → Payment/Order lookup (no I/O).
 * Order of resolution:
 *   1. Payment.externalId already persisted
 *   2. pending row without externalId on Order.publicId (race: webhook before persist)
 *   3. unbound (cancelled/expired/refused, externalId null) on that Order (persist-fail leftover)
 *   else orphan — do not invent Order/Payment
 */
export type WebhookResolveDecision = 'found' | 'link_pending' | 'link_unbound' | 'orphan';

export type WebhookResolveInput = {
  byExternalId: boolean;
  externalReference?: string | null;
  orderFoundByPublicId: boolean;
  pendingWithoutExternalId: boolean;
  unboundPaymentOnOrder: boolean;
};

export function resolveWebhookPayment(input: WebhookResolveInput): WebhookResolveDecision {
  if (input.byExternalId) return 'found';
  const ref = typeof input.externalReference === 'string' ? input.externalReference.trim() : '';
  if (!ref || !input.orderFoundByPublicId) return 'orphan';
  if (input.pendingWithoutExternalId) return 'link_pending';
  if (input.unboundPaymentOnOrder) return 'link_unbound';
  return 'orphan';
}

export function isUnboundLinkableStatus(status: string): boolean {
  return status === 'pending' || status === 'cancelled' || status === 'expired' || status === 'refused';
}

export function pickLinkablePayment<T extends { status: string; externalId?: string | null }>(
  payments: T[],
): T | undefined {
  const unbound = payments.filter((p) => !p.externalId && isUnboundLinkableStatus(p.status));
  return unbound.find((p) => p.status === 'pending') || unbound[0];
}
