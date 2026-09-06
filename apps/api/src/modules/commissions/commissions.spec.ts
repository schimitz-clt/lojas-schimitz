import assert from 'assert';
import {
  DEFAULT_COMMISSION_PERCENT,
  COMMISSION_STATUSES,
  canTransitionCommission,
  commissionAmount,
  resolveCommissionPercent,
} from './commissions.constants';
import {
  assertSellerCanViewCommission,
  filterOwnCommissions,
  sellerOwnsCommission,
} from './commissions.authz';

assert.equal(DEFAULT_COMMISSION_PERCENT, 10);
assert.equal(resolveCommissionPercent(null), 10);
assert.equal(resolveCommissionPercent(undefined), 10);
assert.equal(resolveCommissionPercent(15), 15);
assert.equal(resolveCommissionPercent(0), 0);
assert.equal(resolveCommissionPercent(-1), 0);

assert.equal(commissionAmount(100, 10), 10);
assert.equal(commissionAmount(199.9, 10), 19.99);
assert.equal(commissionAmount(50, 12.5), 6.25);
assert.equal(commissionAmount(0, 10), 0);
assert.equal(commissionAmount(100, 0), 0);

assert.deepEqual([...COMMISSION_STATUSES], ['pending', 'approved', 'paid', 'cancelled']);

// Status transitions (Repasse v1)
assert.equal(canTransitionCommission('pending', 'approved'), true);
assert.equal(canTransitionCommission('pending', 'paid'), true); // single mark-paid
assert.equal(canTransitionCommission('pending', 'cancelled'), true);
assert.equal(canTransitionCommission('approved', 'paid'), true);
assert.equal(canTransitionCommission('approved', 'cancelled'), true);
assert.equal(canTransitionCommission('paid', 'pending'), false);
assert.equal(canTransitionCommission('paid', 'approved'), false);
assert.equal(canTransitionCommission('cancelled', 'paid'), false);
assert.equal(canTransitionCommission('approved', 'pending'), false);
assert.equal(canTransitionCommission('bogus', 'paid'), false);

// Seller can only see own commissions
const A = 'seller-a';
const B = 'seller-b';
assert.equal(sellerOwnsCommission(A, A), true);
assert.equal(sellerOwnsCommission(A, B), false);
assert.equal(sellerOwnsCommission(A, null), false);
assert.equal(sellerOwnsCommission(A, undefined), false);
assert.deepEqual(assertSellerCanViewCommission(A, A), { ok: true });
assert.deepEqual(assertSellerCanViewCommission(A, B), {
  ok: false,
  code: 'FORBIDDEN_OTHER_SELLER_COMMISSION',
});

const mixed = [
  { id: '1', sellerId: A, amount: 10 },
  { id: '2', sellerId: B, amount: 20 },
  { id: '3', sellerId: A, amount: 5 },
];
const own = filterOwnCommissions(A, mixed);
assert.equal(own.length, 2);
assert.deepEqual(
  own.map((r) => r.id),
  ['1', '3'],
);
assert.equal(filterOwnCommissions(B, mixed).length, 1);

console.log('commissions.spec ok');
