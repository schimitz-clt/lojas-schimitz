import assert from 'assert';
import {
  DEFAULT_OPS_LOW_STOCK_THRESHOLD,
  isLowOnHand,
  summarizeInventoryOps,
} from './admin-ops';

assert.equal(DEFAULT_OPS_LOW_STOCK_THRESHOLD, 5);
assert.equal(isLowOnHand(0), true);
assert.equal(isLowOnHand(5), true);
assert.equal(isLowOnHand(6), false);
assert.equal(isLowOnHand(null), false);
assert.equal(isLowOnHand(undefined), false);
assert.equal(isLowOnHand(3, 2), false);
assert.equal(isLowOnHand(2, 2), true);

const snap = summarizeInventoryOps({
  lowStockCount: 4,
  outOfStockCount: 1,
  time: '2026-09-12T00:00:00.000Z',
});
assert.equal(snap.inventory.lowStockThreshold, 5);
assert.equal(snap.inventory.lowStockCount, 4);
assert.equal(snap.inventory.outOfStockCount, 1);
assert.equal(snap.time, '2026-09-12T00:00:00.000Z');

console.log('admin-ops unit tests ok');
