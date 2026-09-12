import assert from 'assert';
import {
  PIX_DISCOUNT_RATE,
  amountsMatchForApprove,
  computeCheckoutTotals,
  couponDiscountAmount,
  moneyEquals,
  pixChargeAmount,
  pixDiscountAmount,
  roundMoney,
} from './pricing';

assert.equal(PIX_DISCOUNT_RATE, 0.05);
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

console.log('pricing unit tests ok');
