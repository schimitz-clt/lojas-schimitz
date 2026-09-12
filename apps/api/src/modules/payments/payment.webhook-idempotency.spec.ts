/**
 * Webhook event idempotency + approve amount gate (no DB / no charges).
 * Mirrors PaymentsService.handleWebhook unique(provider, providerEventId) branch
 * and amountsMatchForApprove used on approve.
 */
import assert from 'assert';
import { amountsMatchForApprove, pixChargeAmount } from '../../common/pricing';

type PaymentEventRow = { id: string; applied: boolean; providerEventId: string };

/** Pure decision after unique violation on PaymentEvent insert. */
function onDuplicateProviderEvent(existing: PaymentEventRow | null | undefined): {
  duplicate: boolean;
  applied: boolean;
  retryApply: boolean;
} {
  if (!existing) {
    return { duplicate: false, applied: false, retryApply: false };
  }
  if (existing.applied) {
    return { duplicate: true, applied: true, retryApply: false };
  }
  // Same event id persisted but not yet applied (crash mid-flight) → retry apply
  return { duplicate: true, applied: false, retryApply: true };
}

{
  const first = onDuplicateProviderEvent(null);
  assert.deepEqual(first, { duplicate: false, applied: false, retryApply: false });
}

{
  const dupApplied = onDuplicateProviderEvent({
    id: 'e1',
    applied: true,
    providerEventId: 'evt-1',
  });
  assert.equal(dupApplied.duplicate, true);
  assert.equal(dupApplied.applied, true);
  assert.equal(dupApplied.retryApply, false);
}

{
  const dupPending = onDuplicateProviderEvent({
    id: 'e2',
    applied: false,
    providerEventId: 'evt-1',
  });
  assert.equal(dupPending.duplicate, true);
  assert.equal(dupPending.retryApply, true);
}

// Same event twice: second call must be ignore_duplicate once applied
{
  const store = new Map<string, PaymentEventRow>();
  function ingest(providerEventId: string) {
    const existing = store.get(providerEventId);
    if (existing) return onDuplicateProviderEvent(existing);
    store.set(providerEventId, { id: 'n1', applied: false, providerEventId });
    // simulate apply
    store.get(providerEventId)!.applied = true;
    return { duplicate: false, applied: true, retryApply: false };
  }
  const a = ingest('evt-dup');
  const b = ingest('evt-dup');
  assert.equal(a.duplicate, false);
  assert.equal(b.duplicate, true);
  assert.equal(b.applied, true);
}

// PIX approve: provider may report charge amount (95) or legacy full total (100)
{
  const orderTotal = 100;
  const paymentAmount = pixChargeAmount(orderTotal);
  assert.equal(paymentAmount, 95);
  assert.equal(
    amountsMatchForApprove({ providerAmount: 95, paymentAmount, orderTotal }),
    true,
  );
  assert.equal(
    amountsMatchForApprove({ providerAmount: 100, paymentAmount, orderTotal }),
    true,
  );
  assert.equal(
    amountsMatchForApprove({ providerAmount: 95.004, paymentAmount, orderTotal }),
    true, // within MONEY_EPS of 95
  );
  assert.equal(
    amountsMatchForApprove({ providerAmount: 94.98, paymentAmount, orderTotal }),
    false, // outside 1-cent tolerance
  );
  assert.equal(
    amountsMatchForApprove({ providerAmount: 80, paymentAmount, orderTotal }),
    false,
  );
}

console.log('payment.webhook-idempotency unit tests ok');
