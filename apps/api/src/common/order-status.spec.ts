import {
  canTransition,
  nextFulfillmentStatus,
  isRefundAllowed,
  shouldRestockOnRefund,
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

console.log('order-status tests ok');
