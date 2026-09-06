import assert from 'assert';
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

console.log('seller-portal.authz.spec ok');
