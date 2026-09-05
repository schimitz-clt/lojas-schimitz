import assert from 'assert';

function available(qtyOnHand: number, qtyReserved: number) {
  return Math.max(0, qtyOnHand - qtyReserved);
}

assert.equal(available(1, 0), 1);
assert.equal(available(1, 1), 0);
assert.equal(available(0, 0), 0);
assert.equal(available(2, 5), 0);
console.log('inventory math tests ok');
