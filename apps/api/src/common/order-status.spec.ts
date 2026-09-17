import {
  canTransition,
  nextFulfillmentStatus,
  isRefundAllowed,
  shouldRestockOnRefund,
  statusesForAdminQueueBucket,
  bucketForOrderStatus,
  POST_PAYMENT_OPS_HINT,
  ADMIN_ORDER_QUEUE_BUCKETS,
  POST_PAID_STATUSES,
  PROBLEM_ORDER_STATUSES,
  STUCK_ORDER_STATUSES,
  TERMINAL_HISTORY_ORDER_STATUSES,
  countStatuses,
  assertValidTransition,
  InvalidOrderTransitionError,
} from './order-status';
import assert from 'assert';

assert.equal(canTransition('awaiting_payment', 'paid'), true);
assert.equal(canTransition('awaiting_payment', 'cancelled'), true);
assert.equal(canTransition('delivered', 'cancelled'), false);
assert.equal(canTransition('paid', 'awaiting_payment'), false);
assert.equal(canTransition('paid', 'organizing'), true);
assert.equal(canTransition('organizing', 'packing'), true);
assert.equal(canTransition('packing', 'ready_for_pickup'), true);
assert.equal(canTransition('ready_for_pickup', 'in_transit'), true);
assert.equal(canTransition('in_transit', 'delivered'), true);
assert.equal(canTransition('paid', 'in_transit'), false);
assert.equal(canTransition('packing', 'delivered'), false);
assert.equal(canTransition('delivered', 'in_transit'), false);
// legado
assert.equal(canTransition('separating', 'packing'), true);
assert.equal(canTransition('shipped', 'delivered'), true);

assert.equal(nextFulfillmentStatus('paid'), 'organizing');
assert.equal(nextFulfillmentStatus('organizing'), 'packing');
assert.equal(nextFulfillmentStatus('packing'), 'ready_for_pickup');
assert.equal(nextFulfillmentStatus('ready_for_pickup'), 'in_transit');
assert.equal(nextFulfillmentStatus('in_transit'), 'delivered');
assert.equal(nextFulfillmentStatus('delivered'), null);

assert.equal(isRefundAllowed('paid'), true);
assert.equal(isRefundAllowed('organizing'), true);
assert.equal(isRefundAllowed('ready_for_pickup'), true);
assert.equal(isRefundAllowed('delivered'), false);
assert.equal(shouldRestockOnRefund('paid'), true);
assert.equal(shouldRestockOnRefund('organizing'), true);
assert.equal(shouldRestockOnRefund('in_transit'), false);

assert.deepEqual([...STUCK_ORDER_STATUSES].sort(), ['separating', 'shipped'].sort());
assert.deepEqual([...TERMINAL_HISTORY_ORDER_STATUSES].sort(), ['cancelled', 'refunded'].sort());
assert.deepEqual(
  [...PROBLEM_ORDER_STATUSES].sort(),
  [...TERMINAL_HISTORY_ORDER_STATUSES, ...STUCK_ORDER_STATUSES].sort(),
);
assert.equal(
  (STUCK_ORDER_STATUSES as readonly string[]).includes('cancelled'),
  false,
  'cancelled is terminal history, not stuck',
);
assert.equal((STUCK_ORDER_STATUSES as readonly string[]).includes('refunded'), false);

assert.deepEqual(statusesForAdminQueueBucket('paid'), ['paid']);
assert.deepEqual(statusesForAdminQueueBucket('problems').sort(), [
  'cancelled',
  'refunded',
  'separating',
  'shipped',
].sort());
assert.equal(bucketForOrderStatus('paid'), 'paid');
assert.equal(bucketForOrderStatus('cancelled'), 'problems');
assert.equal(bucketForOrderStatus('refunded'), 'problems');
assert.equal(bucketForOrderStatus('separating'), 'problems');
assert.equal(bucketForOrderStatus('shipped'), 'problems');
assert.equal(bucketForOrderStatus('draft'), 'draft');
assert.equal(countStatuses({ cancelled: 22, refunded: 0, separating: 0, shipped: 0 }, STUCK_ORDER_STATUSES), 0);
assert.equal(countStatuses({ cancelled: 22, shipped: 1 }, STUCK_ORDER_STATUSES), 1);
assert.equal(countStatuses({ cancelled: 22, refunded: 3 }, TERMINAL_HISTORY_ORDER_STATUSES), 25);
assert.equal(countStatuses(undefined, STUCK_ORDER_STATUSES), 0);
assert.equal(nextFulfillmentStatus('paid'), 'organizing');
assert.ok(POST_PAYMENT_OPS_HINT.includes('organizing'));
assert.ok(ADMIN_ORDER_QUEUE_BUCKETS.includes('problems'));

assert.equal(isRefundAllowed('in_transit'), true);
assert.equal(isRefundAllowed('shipped'), true);
assert.equal(canTransition('in_transit', 'refunded'), true);
assert.equal(canTransition('shipped', 'refunded'), true);
assertValidTransition('paid', 'organizing');
let threw = false;
try {
  assertValidTransition('paid', 'delivered');
} catch (e) {
  threw = true;
  assert.ok(e instanceof InvalidOrderTransitionError);
  assert.equal(e.code, 'INVALID_TRANSITION');
}
assert.ok(threw);


// Admin notify-paid allowlist (API POST_PAID_STATUSES) — packing etc. must be included
assert.ok(POST_PAID_STATUSES.includes('paid'));
assert.ok(POST_PAID_STATUSES.includes('organizing'));
assert.ok(POST_PAID_STATUSES.includes('packing'));
assert.ok(POST_PAID_STATUSES.includes('ready_for_pickup'));
assert.ok(POST_PAID_STATUSES.includes('in_transit'));
assert.ok(POST_PAID_STATUSES.includes('delivered'));
assert.ok(POST_PAID_STATUSES.includes('separating'));
assert.ok(POST_PAID_STATUSES.includes('shipped'));
assert.equal((POST_PAID_STATUSES as readonly string[]).includes('awaiting_payment'), false);
assert.equal((POST_PAID_STATUSES as readonly string[]).includes('cancelled'), false);
assert.equal((POST_PAID_STATUSES as readonly string[]).includes('refunded'), false);

console.log('order-status tests ok');
