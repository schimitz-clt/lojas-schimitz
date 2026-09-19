import assert from 'assert';
import { BadRequestException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  MARKETPLACE_MIXED_CART,
  MARKETPLACE_MIXED_CART_MESSAGE_PT,
  assertSingleSellerCart,
  isMixedSellerCart,
  uniqueSellerIds,
} from './mixed-cart';

assert.deepEqual(uniqueSellerIds([]), []);
assert.deepEqual(uniqueSellerIds([{ sellerId: 'a' }, { sellerId: 'a' }]), ['a']);
assert.equal(isMixedSellerCart([{ sellerId: 'a' }, { sellerId: 'a' }]), false);
assert.equal(isMixedSellerCart([{ sellerId: 'a' }, { sellerId: 'b' }]), true);
assert.equal(isMixedSellerCart([{ sellerId: null }, { sellerId: 'a' }]), false);

assertSingleSellerCart([{ sellerId: 'house' }]);
assertSingleSellerCart([{ sellerId: 'house' }, { sellerId: 'house' }]);

let threw = false;
try {
  assertSingleSellerCart([{ sellerId: 'house' }, { sellerId: 'partner' }]);
} catch (e) {
  threw = true;
  assert.ok(e instanceof BadRequestException);
  const body = e.getResponse() as { code: string; message: string };
  assert.equal(body.code, MARKETPLACE_MIXED_CART);
  assert.equal(body.message, MARKETPLACE_MIXED_CART_MESSAGE_PT);
  assert.ok(body.message.includes('único vendedor'));
}
assert.equal(threw, true);

const ordersSrc = readFileSync(join(__dirname, '../orders/orders.service.ts'), 'utf8');
assert.ok(ordersSrc.includes('assertSingleSellerCart'), 'checkout must reject mixed seller carts');
assert.ok(
  /assertSingleSellerCart\(cart\.items/.test(ordersSrc),
  'mixed-cart check runs on order create cart items',
);

console.log('mixed-cart.spec ok');
