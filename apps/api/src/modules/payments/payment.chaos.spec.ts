/**
 * Controlled chaos unit checks — duplicate webhook + expire edges (no DB / no charges).
 * Complements payment.webhook-idempotency + payment.status-machine.
 */
import assert from 'assert';

type PaymentEventRow = { id: string; applied: boolean; providerEventId: string };

function onDuplicateProviderEvent(existing: PaymentEventRow | null | undefined): {
  duplicate: boolean;
  applied: boolean;
  retryApply: boolean;
} {
  if (!existing) return { duplicate: false, applied: false, retryApply: false };
  if (existing.applied) return { duplicate: true, applied: true, retryApply: false };
  return { duplicate: true, applied: false, retryApply: true };
}

const PAYMENT_ALLOWED: Record<string, string[]> = {
  pending: ['approved', 'refused', 'expired', 'cancelled'],
  approved: ['refunded'],
  refused: [],
  expired: [],
  cancelled: [],
  refunded: [],
};

function canPaymentTransition(from: string, to: string) {
  return (PAYMENT_ALLOWED[from] || []).includes(to);
}

/** Expire payment must NOT force order into cancelled (ops can still collect / recreate PIX). */
function orderStatusAfterPaymentExpire(currentOrderStatus: string): string {
  if (currentOrderStatus === 'awaiting_payment') return 'awaiting_payment';
  return currentOrderStatus;
}

// --- duplicate webhook (chaos: same event delivered twice) ---
{
  const store = new Map<string, PaymentEventRow>();
  function ingest(providerEventId: string) {
    const existing = store.get(providerEventId);
    if (existing) return onDuplicateProviderEvent(existing);
    store.set(providerEventId, { id: 'n1', applied: true, providerEventId });
    return { duplicate: false, applied: true, retryApply: false };
  }
  const a = ingest('chaos-evt-1');
  const b = ingest('chaos-evt-1');
  assert.equal(a.duplicate, false);
  assert.equal(b.duplicate, true);
  assert.equal(b.applied, true);
  assert.equal(b.retryApply, false);
}

// --- expire edges ---
assert.equal(canPaymentTransition('pending', 'expired'), true);
assert.equal(canPaymentTransition('expired', 'approved'), false);
assert.equal(canPaymentTransition('expired', 'pending'), false);
assert.equal(orderStatusAfterPaymentExpire('awaiting_payment'), 'awaiting_payment');
assert.equal(orderStatusAfterPaymentExpire('paid'), 'paid');

// --- already_approved must not blind no-op when order still needs CAS/notify ---
type OrderSt = 'awaiting_payment' | 'paid' | 'cancelled' | 'shipped';
function alreadyApprovedDecision(orderStatus: OrderSt): 'notify' | 'recover' | 'noop' {
  if (orderStatus === 'paid') return 'notify';
  if (orderStatus === 'awaiting_payment' || orderStatus === 'cancelled') return 'recover';
  return 'noop';
}
assert.equal(alreadyApprovedDecision('paid'), 'notify');
assert.equal(alreadyApprovedDecision('awaiting_payment'), 'recover');
assert.equal(alreadyApprovedDecision('cancelled'), 'recover');
assert.equal(alreadyApprovedDecision('shipped'), 'noop');

// Race: webhook before externalId persisted → link by publicId, do not orphan
function resolveLocalPayment(opts: {
  byExternalId: boolean;
  pendingWithoutExternalId: boolean;
  hasExternalReference: boolean;
}): 'linked' | 'orphan' | 'found' {
  if (opts.byExternalId) return 'found';
  if (opts.hasExternalReference && opts.pendingWithoutExternalId) return 'linked';
  return 'orphan';
}
assert.equal(resolveLocalPayment({ byExternalId: true, pendingWithoutExternalId: false, hasExternalReference: true }), 'found');
assert.equal(resolveLocalPayment({ byExternalId: false, pendingWithoutExternalId: true, hasExternalReference: true }), 'linked');
assert.equal(resolveLocalPayment({ byExternalId: false, pendingWithoutExternalId: false, hasExternalReference: true }), 'orphan');
assert.equal(resolveLocalPayment({ byExternalId: false, pendingWithoutExternalId: true, hasExternalReference: false }), 'orphan');

console.log('payment.chaos unit tests ok');
console.log('payment.chaos already_approved recovery + externalId link checks ok');
