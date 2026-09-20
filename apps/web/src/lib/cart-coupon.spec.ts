import assert from 'assert';
import {
  cartDiscountAmount,
  cartPayableTotal,
  couponApplyBusyLabel,
  couponDiscountLineLabel,
} from './cart-coupon';

assert.equal(cartDiscountAmount({ code: 'SCHIMITZ10', discount: 20, finalSubtotal: 180 }), 20);
assert.equal(cartDiscountAmount(null, 0), 0);
assert.equal(cartDiscountAmount(undefined, 5), 5);
assert.equal(cartPayableTotal(200, 20), 180);
assert.equal(cartPayableTotal(40, 50), 0);
assert.equal(couponDiscountLineLabel('schimitz10'), 'Cupom SCHIMITZ10');
assert.equal(couponDiscountLineLabel(''), 'Cupom');
assert.equal(couponApplyBusyLabel(true), 'Validando...');
assert.equal(couponApplyBusyLabel(false), 'Aplicar');

console.log('cart-coupon display helpers ok');
