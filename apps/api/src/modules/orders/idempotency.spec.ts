import assert from 'assert';
import { canonicalOrderHash, IDEMPOTENCY_KEY_RE, requireIdempotencyKey } from './idempotency';

assert.equal(IDEMPOTENCY_KEY_RE.test('abcd1234'), true);
assert.equal(IDEMPOTENCY_KEY_RE.test('short'), false);
assert.equal(IDEMPOTENCY_KEY_RE.test('bad key'), false);
assert.equal(IDEMPOTENCY_KEY_RE.test('a'.repeat(128)), true);
assert.equal(IDEMPOTENCY_KEY_RE.test('a'.repeat(129)), false);

try {
  requireIdempotencyKey(undefined);
  assert.fail('expected required');
} catch (e: any) {
  assert.equal(e.getResponse().code, 'IDEMPOTENCY_KEY_REQUIRED');
}

try {
  requireIdempotencyKey('xx');
  assert.fail('expected invalid');
} catch (e: any) {
  assert.equal(e.getResponse().code, 'IDEMPOTENCY_KEY_INVALID');
}

const itemsA = [
  { productId: 'b', qty: 1 },
  { productId: 'a', qty: 2 },
];
const itemsB = [
  { productId: 'a', qty: 2 },
  { productId: 'b', qty: 1 },
];
const base = { addressId: 'addr-1', couponCode: 'OFF10' };
assert.equal(canonicalOrderHash({ ...base, items: itemsA }), canonicalOrderHash({ ...base, items: itemsB }));
assert.notEqual(
  canonicalOrderHash({ ...base, items: itemsA }),
  canonicalOrderHash({ ...base, items: [{ productId: 'a', qty: 9 }, { productId: 'b', qty: 1 }] }),
);
assert.notEqual(
  canonicalOrderHash({ ...base, items: itemsA }),
  canonicalOrderHash({ addressId: 'addr-2', couponCode: 'OFF10', items: itemsA }),
);
assert.equal(
  canonicalOrderHash({ addressId: 'x', couponCode: undefined, items: [] }),
  canonicalOrderHash({ addressId: 'x', couponCode: null, items: [] }),
);

console.log('idempotency unit tests ok');
