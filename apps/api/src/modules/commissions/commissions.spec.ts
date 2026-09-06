import assert from 'assert';
import {
  DEFAULT_COMMISSION_PERCENT,
  commissionAmount,
  resolveCommissionPercent,
} from './commissions.constants';

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

console.log('commissions.spec ok');
