import { canTransition } from './order-status';
import assert from 'assert';

assert.equal(canTransition('awaiting_payment', 'paid'), true);
assert.equal(canTransition('awaiting_payment', 'cancelled'), true);
assert.equal(canTransition('delivered', 'cancelled'), false);
assert.equal(canTransition('paid', 'awaiting_payment'), false);
assert.equal(canTransition('paid', 'separating'), true);
assert.equal(canTransition('separating', 'shipped'), true);
assert.equal(canTransition('shipped', 'delivered'), true);
assert.equal(canTransition('paid', 'shipped'), false);
assert.equal(canTransition('separating', 'delivered'), false);
assert.equal(canTransition('delivered', 'shipped'), false);
console.log('order-status tests ok');
