import assert from 'assert';

function calcDiscount(type: string, value: number, subtotal: number) {
  let discount = type === 'percent' ? subtotal * (value / 100) : value;
  discount = Math.min(discount, subtotal);
  return Math.round(discount * 100) / 100;
}

assert.equal(calcDiscount('percent', 5, 200), 10);
assert.equal(calcDiscount('fixed', 30, 200), 30);
assert.equal(calcDiscount('fixed', 50, 40), 40);
assert.equal(calcDiscount('percent', 100, 99.9), 99.9);
console.log('coupon validate math tests ok');
