/**
 * Inventory available formula + negative guards (unit, no DB).
 * available = max(0, qtyOnHand − qtyReserved); never negative.
 */
import assert from 'assert';
import { availableQty, isInventoryConsistent } from './inventory.math';

// Formula: available = onHand − reserved, floored at 0
assert.equal(availableQty(1, 0), 1);
assert.equal(availableQty(1, 1), 0);
assert.equal(availableQty(0, 0), 0);
assert.equal(availableQty(2, 5), 0, 'oversold / reserved>onHand clamps to 0');
assert.equal(availableQty(10, 3), 7);
assert.equal(availableQty(0, 1), 0, 'reserved without onHand → 0 available');
console.log('inventory.math: available formula — PASSOU');

// Non-finite → 0
assert.equal(availableQty(Number.NaN, 1), 0);
assert.equal(availableQty(10, Number.NaN), 0);
assert.equal(availableQty(Number.POSITIVE_INFINITY, 1), 0);
assert.equal(availableQty(5, Number.POSITIVE_INFINITY), 0);
console.log('inventory.math: non-finite guards — PASSOU');

// Consistency helper (reserved ≤ onHand, both ≥ 0)
assert.equal(isInventoryConsistent(10, 3), true);
assert.equal(isInventoryConsistent(1, 1), true);
assert.equal(isInventoryConsistent(0, 0), true);
assert.equal(isInventoryConsistent(2, 5), false, 'reserved > onHand inconsistent');
assert.equal(isInventoryConsistent(-1, 0), false);
assert.equal(isInventoryConsistent(5, -1), false);
assert.equal(isInventoryConsistent(Number.NaN, 0), false);
console.log('inventory.math: isInventoryConsistent — PASSOU');

// Invariant: available never negative for any finite integers in typical range
for (const onHand of [-2, -1, 0, 1, 2, 100]) {
  for (const reserved of [-2, -1, 0, 1, 2, 50, 100]) {
    const a = availableQty(onHand, reserved);
    assert.ok(a >= 0, `available(${onHand},${reserved})=${a} must be >= 0`);
    assert.equal(a, Math.max(0, onHand - reserved));
  }
}
console.log('inventory.math: never-negative sweep — PASSOU');

console.log('inventory math tests ok');
