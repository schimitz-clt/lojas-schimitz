import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  couponDiscountAmount,
  isPixPromoCollidingCouponCode,
  PIX_PROMO_COLLIDING_COUPON_CODES,
} from '../../common/pricing';
import { evaluateCoupon } from './coupon-evaluate';

assert.equal(couponDiscountAmount('percent', 5, 200), 10);
assert.equal(evaluateCoupon({
  type: 'percent',
  value: 10,
  active: true,
}, 200).ok, true);

assert.deepEqual([...PIX_PROMO_COLLIDING_COUPON_CODES], ['PIX5']);
assert.equal(isPixPromoCollidingCouponCode('PIX5'), true);
assert.equal(isPixPromoCollidingCouponCode('off10'), false);

const svc = readFileSync(join(__dirname, 'coupons.service.ts'), 'utf8');
assert.ok(svc.includes('isPixPromoCollidingCouponCode'), 'validate uses shared colliding helper');
assert.ok(svc.includes('collidesWithPixPromo'), 'validate exposes collidesWithPixPromo');
assert.equal(svc.includes("'PIX5'"), false, 'no magic PIX5 string in coupons.service');

const seed = readFileSync(join(__dirname, '../../../../../prisma/seed.ts'), 'utf8');
assert.ok(seed.includes("where: { code: 'PIX5' }"), 'seed still upserts PIX5 row');
assert.ok(
  /where: \{ code: 'PIX5' \}[\s\S]{0,80}update: \{ active: false/.test(seed),
  'seed must not re-activate PIX5',
);
assert.ok(seed.includes("where: { code: 'SCHIMITZ10' }"), 'seed upserts SCHIMITZ10 pilot');
assert.ok(seed.includes("code: 'SCHIMITZ10'"), 'seed creates SCHIMITZ10');

console.log('coupon validate math tests ok');
