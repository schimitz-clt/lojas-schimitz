/**
 * Unit: upsert/idempotent reconciliation reason codes (no DB).
 */
import assert from 'assert';
import {
  isOrphanMoneyAtRisk,
  orphanReconciliationReason,
  RECONCILIATION_STATUS_OPEN,
} from './reconciliation';

assert.equal(orphanReconciliationReason('approved'), 'orphan_approved');
assert.equal(orphanReconciliationReason('APPROVED'), 'orphan_approved');
assert.equal(orphanReconciliationReason('paid'), 'orphan_paid_status');
assert.equal(orphanReconciliationReason('pending'), 'orphan_pending');
assert.equal(orphanReconciliationReason('refused'), 'orphan_refused');
assert.equal(orphanReconciliationReason('expired'), 'orphan_expired');
assert.equal(orphanReconciliationReason('cancelled'), 'orphan_cancelled');
assert.equal(orphanReconciliationReason('refunded'), 'orphan_refunded');
assert.equal(orphanReconciliationReason('weird'), 'orphan_unknown');
assert.equal(orphanReconciliationReason(''), 'orphan_unknown');

assert.equal(isOrphanMoneyAtRisk('approved'), true);
assert.equal(isOrphanMoneyAtRisk('paid'), true);
assert.equal(isOrphanMoneyAtRisk('pending'), false);
assert.equal(isOrphanMoneyAtRisk('refused'), false);

assert.equal(RECONCILIATION_STATUS_OPEN, 'RECONCILIATION_REQUIRED');

/** Simulate upsert key uniqueness: same provider+externalId → one open row, reason refreshed. */
type RecRow = {
  provider: string;
  externalId: string;
  reason: string;
  status: string;
  providerStatus: string;
};
function upsertRecon(
  store: Map<string, RecRow>,
  input: { provider: string; externalId: string; providerStatus: string },
): RecRow {
  const key = `${input.provider}:${input.externalId}`;
  const reason = orphanReconciliationReason(input.providerStatus);
  const existing = store.get(key);
  if (existing) {
    existing.reason = reason;
    existing.providerStatus = input.providerStatus;
    existing.status = RECONCILIATION_STATUS_OPEN;
    return existing;
  }
  const row: RecRow = {
    provider: input.provider,
    externalId: input.externalId,
    reason,
    status: RECONCILIATION_STATUS_OPEN,
    providerStatus: input.providerStatus,
  };
  store.set(key, row);
  return row;
}

{
  const store = new Map<string, RecRow>();
  const a = upsertRecon(store, { provider: 'mercadopago', externalId: 'mp-1', providerStatus: 'approved' });
  const b = upsertRecon(store, { provider: 'mercadopago', externalId: 'mp-1', providerStatus: 'approved' });
  assert.equal(store.size, 1);
  assert.strictEqual(a, b);
  assert.equal(a.reason, 'orphan_approved');
  assert.equal(a.status, 'RECONCILIATION_REQUIRED');
}

{
  const store = new Map<string, RecRow>();
  upsertRecon(store, { provider: 'mercadopago', externalId: 'mp-2', providerStatus: 'pending' });
  const again = upsertRecon(store, { provider: 'mercadopago', externalId: 'mp-2', providerStatus: 'approved' });
  assert.equal(store.size, 1);
  assert.equal(again.reason, 'orphan_approved');
}

console.log('reconciliation unit tests ok');
