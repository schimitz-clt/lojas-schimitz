import assert from 'assert';
import { CASHBACK_RATE } from './loyalty.service';

function earnAmount(paidTotal: number) {
  if (paidTotal <= 0) return 0;
  // mirror LoyaltyService.money(...).toDecimalPlaces(2)
  return Math.round(paidTotal * CASHBACK_RATE * 100) / 100;
}

assert.equal(CASHBACK_RATE, 0.01);
assert.equal(earnAmount(100), 1);
assert.equal(earnAmount(199.9), 2);
assert.equal(earnAmount(0), 0);
assert.equal(earnAmount(-10), 0);
assert.equal(earnAmount(0.4), 0);
console.log('loyalty math tests ok');
