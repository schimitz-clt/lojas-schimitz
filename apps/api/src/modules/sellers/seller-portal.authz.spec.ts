import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  assertSellerCanUpdateProduct,
  sellerOwnsOrderItem,
  sellerOwnsProduct,
} from './seller-portal.authz';

const A = 'seller-a';
const B = 'seller-b';

assert.equal(sellerOwnsProduct(A, A), true);
assert.equal(sellerOwnsProduct(A, B), false);
assert.equal(sellerOwnsProduct(A, null), false);
assert.equal(sellerOwnsProduct(A, undefined), false);

assert.deepEqual(assertSellerCanUpdateProduct(A, A), { ok: true });
assert.deepEqual(assertSellerCanUpdateProduct(A, B), {
  ok: false,
  code: 'FORBIDDEN_OTHER_SELLER',
});

assert.equal(sellerOwnsOrderItem(A, { sellerId: A }), true);
assert.equal(sellerOwnsOrderItem(A, { sellerId: B }), false);
assert.equal(sellerOwnsOrderItem(A, { sellerId: null, productSellerId: A }), true);
assert.equal(sellerOwnsOrderItem(A, { sellerId: null, productSellerId: B }), false);

const svc = readFileSync(join(__dirname, 'seller-portal.service.ts'), 'utf8');
assert.ok(svc.includes("code: 'PRODUCT_NOT_FOUND'"), 'other-seller product is 404, not 403');
assert.ok(
  !/assertSellerCanUpdateProduct[\s\S]{0,180}ForbiddenException/.test(svc),
  'updateProduct must not 403 on other seller (enumerates existence)',
);

console.log('seller-portal.authz.spec ok');
