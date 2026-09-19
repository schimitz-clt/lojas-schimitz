/**
 * Phase 1 fail-closed: Payments API body must never carry marketplace split fields.
 * Even if MP_MARKETPLACE_SPLIT_ALLOW_LIVE is accidentally true, createIntent
 * must call this and must not assign these keys.
 */

export const MP_SPLIT_PAYMENT_BODY_KEYS = [
  'application_fee',
  'marketplace_fee',
  'collector_id',
  'sponsor_id',
  'disbursements',
] as const;

export function assertNoLiveMarketplaceSplitFields(body: Record<string, unknown>): void {
  for (const key of MP_SPLIT_PAYMENT_BODY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] != null) {
      const err: Error & { code?: string } = new Error(
        'Fase 1: application_fee / token de vendedor proibidos no pagamento (fail-closed).',
      );
      err.code = 'PHASE1_SPLIT_FORBIDDEN';
      throw err;
    }
  }
}
