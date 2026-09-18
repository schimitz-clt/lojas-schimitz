import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PIX_DISCOUNT_RATE,
  PIX_PROMO_COLLIDING_COUPON_CODES,
  MAX_INSTALLMENTS,
  INTEREST_FREE_INSTALLMENTS,
  amountsMatchForApprove,
  collidingPixPromoCouponCodes,
  computeCheckoutTotals,
  couponDiscountAmount,
  isPixPromoCollidingCouponCode,
  moneyEquals,
  pixChargeAmount,
  pixDiscountAmount,
  pixIntentChargeAmount,
  roundMoney,
} from './pricing';

assert.equal(PIX_DISCOUNT_RATE, 0.05);
assert.equal(MAX_INSTALLMENTS, 12);
assert.equal(INTEREST_FREE_INSTALLMENTS, 3);
assert.ok(INTEREST_FREE_INSTALLMENTS < MAX_INSTALLMENTS);
assert.equal(pixChargeAmount(100), 95);
assert.equal(pixDiscountAmount(100), 5);
assert.equal(pixChargeAmount(19.9), 18.9);
assert.equal(roundMoney(10.005), 10.01);
assert.equal(pixChargeAmount(0), 0);
assert.equal(moneyEquals(95, 95.004), true);
assert.equal(moneyEquals(95, 95.02), false);

// Coupon math
assert.equal(couponDiscountAmount('percent', 5, 200), 10);
assert.equal(couponDiscountAmount('fixed', 30, 200), 30);
assert.equal(couponDiscountAmount('fixed', 50, 40), 40);
assert.equal(couponDiscountAmount('percent', 100, 99.9), 99.9);

// Checkout totals: subtotal − coupon − cashback + freight
{
  const t = computeCheckoutTotals({
    lineSubtotals: [49.9, 49.9],
    couponDiscount: 10,
    cashbackUsed: 5,
    freight: 19.9,
  });
  assert.equal(t.subtotal, 99.8);
  assert.equal(t.couponDiscount, 10);
  assert.equal(t.cashbackUsed, 5);
  assert.equal(t.freight, 19.9);
  assert.equal(t.totalDiscount, 15);
  assert.equal(t.total, 104.7); // 99.8 - 15 + 19.9
  assert.equal(t.pixCharge, pixChargeAmount(104.7));
  assert.equal(t.pixDiscount, pixDiscountAmount(104.7));
}

// Free shipping / no discounts
{
  const t = computeCheckoutTotals({ subtotal: 299, freight: 0 });
  assert.equal(t.total, 299);
  assert.equal(t.pixCharge, 284.05);
}

// Cashback cannot exceed subtotal − coupon
{
  const t = computeCheckoutTotals({
    subtotal: 100,
    couponDiscount: 80,
    cashbackUsed: 50,
    freight: 10,
  });
  assert.equal(t.cashbackUsed, 20);
  assert.equal(t.total, 10); // 100 - 80 - 20 + 10
}

// Float hygiene on line prices
{
  const t = computeCheckoutTotals({
    lineSubtotals: [0.1, 0.2],
    freight: 0,
  });
  assert.equal(t.subtotal, 0.3);
  assert.equal(t.total, 0.3);
}

// PIX on rounded checkout with coupon + freight
{
  const coupon = couponDiscountAmount('percent', 10, 199.9);
  const t = computeCheckoutTotals({
    subtotal: 199.9,
    couponDiscount: coupon,
    freight: 29.9,
  });
  assert.equal(coupon, 19.99);
  assert.equal(t.total, 209.81); // 199.9 - 19.99 + 29.9
  assert.equal(t.pixCharge, 199.32); // 95% of 209.81
  assert.equal(roundMoney(t.total - t.pixCharge), t.pixDiscount);
}

// Approve amount gate: payment.amount is authority (PIX 95%)
assert.equal(
  amountsMatchForApprove({ providerAmount: 95, paymentAmount: 95, orderTotal: 100 }),
  true,
);
assert.equal(
  amountsMatchForApprove({ providerAmount: 100, paymentAmount: 95, orderTotal: 100 }),
  true, // order.total still accepted (card-compatible / legacy)
);
assert.equal(
  amountsMatchForApprove({ providerAmount: 95.004, paymentAmount: 95, orderTotal: 100 }),
  true, // tolerance vs payment.amount (PIX float)
);
assert.equal(
  amountsMatchForApprove({ providerAmount: 90, paymentAmount: 95, orderTotal: 100 }),
  false,
);

// PIX promo vs coupon: named colliding list (no magic strings in payments.service)
assert.deepEqual([...PIX_PROMO_COLLIDING_COUPON_CODES], ['PIX5']);
assert.equal(isPixPromoCollidingCouponCode('pix5'), true);
assert.equal(isPixPromoCollidingCouponCode(' PIX5 '), true);
assert.equal(isPixPromoCollidingCouponCode('OFF10'), false);
assert.equal(isPixPromoCollidingCouponCode(null), false);
assert.equal(isPixPromoCollidingCouponCode('FOO5', 'FOO5,BAR5'), true);
assert.ok(collidingPixPromoCouponCodes('').includes('PIX5'));
assert.ok(collidingPixPromoCouponCodes('PIX05').includes('PIX05'));

// PIX intent + PIX5 → no double 5% (charge post-coupon total)
assert.equal(pixIntentChargeAmount(95, 'PIX5'), 95);
assert.equal(pixIntentChargeAmount(95, 'pix5'), 95);
{
  const t = computeCheckoutTotals({
    subtotal: 100,
    couponDiscount: couponDiscountAmount('percent', 5, 100),
    couponCode: 'PIX5',
  });
  assert.equal(t.total, 95);
  assert.equal(t.pixCharge, 95);
  assert.equal(t.pixDiscount, 0);
}

// PIX intent + unrelated coupon → automatic PIX 5% on post-coupon total
assert.equal(pixIntentChargeAmount(90, 'OFF10'), pixChargeAmount(90));
assert.equal(pixIntentChargeAmount(90, 'OFF10'), 85.5);
{
  const t = computeCheckoutTotals({
    subtotal: 100,
    couponDiscount: couponDiscountAmount('percent', 10, 100),
    couponCode: 'OFF10',
  });
  assert.equal(t.total, 90);
  assert.equal(t.pixCharge, 85.5);
  assert.equal(t.pixDiscount, 4.5);
}

// Card path is order.total (this helper is PIX-only; no coupon still 95%)
assert.equal(pixIntentChargeAmount(100, null), 95);
assert.equal(pixIntentChargeAmount(100), pixChargeAmount(100));

const paySrc = readFileSync(join(__dirname, '../modules/payments/payments.service.ts'), 'utf8');
assert.ok(paySrc.includes('pixIntentChargeAmount'), 'PIX intent uses pixIntentChargeAmount');
assert.ok(paySrc.includes('coupon: { select: { code: true } }'), 'PIX intent loads coupon code');
assert.equal(
  /method === 'pix' \? pixChargeAmount/.test(paySrc),
  false,
  'do not apply pixChargeAmount blindly on PIX intent',
);

console.log('pricing unit tests ok');
