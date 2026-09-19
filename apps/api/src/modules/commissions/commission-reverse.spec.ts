import assert from 'assert';
import { canTransitionCommission } from './commissions.constants';

assert.equal(canTransitionCommission('pending', 'cancelled'), true);
assert.equal(canTransitionCommission('approved', 'cancelled'), true);
assert.equal(canTransitionCommission('paid', 'cancelled'), false);
assert.equal(canTransitionCommission('cancelled', 'pending'), false);

const src = require('fs').readFileSync(require('path').join(__dirname, 'commissions.service.ts'), 'utf8');
assert.ok(src.includes('reverseOnRefund'), 'refund must reverse mp_application_fee rows');
assert.ok(src.includes("source: 'mp_application_fee'"), 'recordOnPaid accepts split source');
assert.ok(src.includes('COMMISSION_SPLIT_SOURCE'), 'markPaid blocked for split source');

const paySrc = require('fs').readFileSync(
  require('path').join(__dirname, '../payments/payments.service.ts'),
  'utf8',
);
assert.ok(paySrc.includes('reverseOnRefund'), 'finalizeRefundLocal reverses split ledger');
assert.ok(paySrc.includes('recordCommissionForPayment'), 'paid path records split source');
assert.ok(paySrc.includes('fetchPaymentResolvingCollector'), 'webhook resolves seller collector');

console.log('commission-reverse.spec ok');
