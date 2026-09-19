/**
 * PIX 5% is absorbed by the platform when computing application_fee:
 * fee = commissionAmount(chargeAmount, percent) and PIX chargeAmount is 95% of order total.
 */
import assert from 'assert';
import { pixChargeAmount, pixIntentChargeAmount, roundMoney } from '../../common/pricing';
import { commissionAmount } from '../commissions/commissions.constants';

function applicationFeeFromCharge(chargeAmount: number, percent: number): number {
  return commissionAmount(chargeAmount, percent);
}

// Card: fee on full checkout total
assert.equal(applicationFeeFromCharge(100, 10), 10);
assert.equal(applicationFeeFromCharge(199.9, 10), 19.99);
assert.equal(applicationFeeFromCharge(10.01, 10), 1);

// PIX: charge is 95%; platform absorbs the 5% as a smaller fee base
assert.equal(pixIntentChargeAmount(100, null), 95);
assert.equal(applicationFeeFromCharge(pixIntentChargeAmount(100, null), 10), 9.5);
assert.equal(applicationFeeFromCharge(pixChargeAmount(200), 10), 19);
assert.equal(applicationFeeFromCharge(pixIntentChargeAmount(33.33, null), 10), 3.17);

// Colliding PIX5 coupon: no second 5%; fee on already-discounted total
assert.equal(pixIntentChargeAmount(95, 'PIX5'), 95);
assert.equal(applicationFeeFromCharge(pixIntentChargeAmount(95, 'PIX5'), 10), 9.5);

// Rounding: same helpers as checkout / ledger
assert.equal(roundMoney(9.994), 9.99);
assert.equal(roundMoney(9.996), 10);
assert.equal(commissionAmount(199.9, 10), 19.99);
assert.equal(applicationFeeFromCharge(50, 12.5), 6.25);
assert.equal(applicationFeeFromCharge(33.33, 10), 3.33);

// Fee must stay below charge
assert.ok(applicationFeeFromCharge(95, 10) < 95);
assert.equal(applicationFeeFromCharge(0, 10), 0);
assert.equal(applicationFeeFromCharge(50, 0), 0);

console.log('application-fee-pix.spec ok');
