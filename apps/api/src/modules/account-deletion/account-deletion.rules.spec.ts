import assert from 'assert';
import {
  DELETION_CANCELLED,
  DELETION_PROCESSED,
  DELETION_REQUESTED,
  OPEN_ORDER_STATUSES,
  anonymizedEmail,
  cleanDeletionReason,
  deletionStateFromEvents,
  isAnonymizedEmail,
  nextEventAt,
  processBlocker,
} from './account-deletion.rules';

const t = (m: number) => new Date(Date.UTC(2026, 9, 9, 12, m));

assert.deepEqual(deletionStateFromEvents([]), { status: 'none' });
assert.deepEqual(deletionStateFromEvents([{ action: DELETION_REQUESTED, createdAt: t(1) }]), {
  status: 'pending',
  requestedAt: t(1),
});
// ordem de entrada não importa; o último evento decide
assert.deepEqual(
  deletionStateFromEvents([
    { action: DELETION_CANCELLED, createdAt: t(2) },
    { action: DELETION_REQUESTED, createdAt: t(1) },
  ]),
  { status: 'none' },
);
assert.deepEqual(
  deletionStateFromEvents([
    { action: DELETION_REQUESTED, createdAt: t(1) },
    { action: DELETION_CANCELLED, createdAt: t(2) },
    { action: DELETION_REQUESTED, createdAt: t(3) },
  ]),
  { status: 'pending', requestedAt: t(3) },
);
assert.deepEqual(
  deletionStateFromEvents([
    { action: DELETION_REQUESTED, createdAt: t(1) },
    { action: 'order.refund', createdAt: t(4) },
    { action: DELETION_PROCESSED, createdAt: t(3) },
  ]),
  { status: 'processed', processedAt: t(3) },
);

const pending = { status: 'pending' as const, requestedAt: t(1) };
assert.equal(processBlocker({ role: 'customer', sellersOwned: 0, openOrders: 0, state: pending }), null);
assert.equal(processBlocker({ role: 'admin', sellersOwned: 0, openOrders: 0, state: pending }), 'not_customer');
assert.equal(processBlocker({ role: 'customer', sellersOwned: 1, openOrders: 0, state: pending }), 'seller_owner');
assert.equal(processBlocker({ role: 'customer', sellersOwned: 0, openOrders: 2, state: pending }), 'open_orders');
assert.equal(processBlocker({ role: 'customer', sellersOwned: 0, openOrders: 0, state: { status: 'none' } }), 'not_requested');
assert.equal(
  processBlocker({ role: 'customer', sellersOwned: 0, openOrders: 0, state: { status: 'processed', processedAt: t(2) } }),
  'already_processed',
);

// pedidos terminados não bloqueiam; em andamento sim
for (const s of ['delivered', 'cancelled', 'refunded', 'draft']) assert.ok(!(OPEN_ORDER_STATUSES as readonly string[]).includes(s));
for (const s of ['awaiting_payment', 'paid', 'organizing', 'in_transit']) assert.ok((OPEN_ORDER_STATUSES as readonly string[]).includes(s));

const e = anonymizedEmail('abc');
assert.equal(e, 'excluido-abc@conta-excluida.invalid');
assert.ok(isAnonymizedEmail(e));
assert.ok(!isAnonymizedEmail('cliente@exemplo.com'));

assert.equal(cleanDeletionReason(undefined), null);
assert.equal(cleanDeletionReason('   '), null);
assert.equal(cleanDeletionReason(' não\nuso mais '), 'não uso mais');
assert.equal(cleanDeletionReason('x'.repeat(999))?.length, 300);

assert.equal(nextEventAt(t(5), t(1)).getTime(), t(5).getTime());
assert.equal(nextEventAt(t(1), t(1)).getTime(), t(1).getTime() + 1);
assert.equal(nextEventAt(t(1), null).getTime(), t(1).getTime());

console.log('account-deletion.rules.spec ok');
