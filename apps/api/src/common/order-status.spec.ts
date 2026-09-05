import { canTransition } from './order-status';
import assert from 'assert';

assert.equal(canTransition('awaiting_payment', 'paid'), true);
assert.equal(canTransition('awaiting_payment', 'cancelled'), true);
assert.equal(canTransition('delivered', 'cancelled'), false);
assert.equal(canTransition('paid', 'awaiting_payment'), false);
assert.equal(canTransition('shipped', 'delivered'), true);
console.log('order-status tests ok');
