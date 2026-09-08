import assert from 'assert';
import { PIX_DISCOUNT_RATE, pixChargeAmount, pixDiscountAmount, roundMoney } from './pricing';

assert.equal(PIX_DISCOUNT_RATE, 0.05);
assert.equal(pixChargeAmount(100), 95);
assert.equal(pixDiscountAmount(100), 5);
assert.equal(pixChargeAmount(19.9), 18.9);
assert.equal(roundMoney(10.005), 10.01);
assert.equal(pixChargeAmount(0), 0);

console.log('pricing unit tests ok');
