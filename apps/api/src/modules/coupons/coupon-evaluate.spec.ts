import assert from 'assert';
import {
  evaluateCoupon,
  formatCouponMinSubtotalMessage,
  isPermanentCouponFailure,
  parseCouponDate,
} from './coupon-evaluate';
import { normalizeCouponCode } from '../../common/pricing';

const now = new Date('2026-09-20T12:00:00.000Z');

const base = {
  code: 'SCHIMITZ10',
  type: 'percent',
  value: 10,
  active: true,
  minSubtotal: 0,
  startsAt: null,
  endsAt: null,
  maxUses: null,
  usedCount: 0,
  reservedCount: 0,
};

assert.deepEqual(evaluateCoupon(null, 100, now), {
  ok: false,
  code: 'COUPON_INVALID',
  message: 'Cupom inválido',
});
assert.equal(evaluateCoupon({ ...base, active: false }, 100, now).ok, false);
assert.equal((evaluateCoupon({ ...base, active: false }, 100, now) as { code: string }).code, 'COUPON_INVALID');

assert.equal(
  (evaluateCoupon({ ...base, startsAt: '2026-12-01T00:00:00.000Z' }, 100, now) as { code: string }).code,
  'COUPON_NOT_STARTED',
);
assert.equal(
  (evaluateCoupon({ ...base, endsAt: '2026-01-01T00:00:00.000Z' }, 100, now) as { code: string }).code,
  'COUPON_EXPIRED',
);
assert.equal(
  (evaluateCoupon({ ...base, maxUses: 5, usedCount: 3, reservedCount: 2 }, 100, now) as { code: string }).code,
  'COUPON_EXHAUSTED',
);
assert.equal(
  evaluateCoupon({ ...base, maxUses: 5, usedCount: 3, reservedCount: 1 }, 100, now).ok,
  true,
);

const belowMin = evaluateCoupon({ ...base, minSubtotal: 150 }, 100, now);
assert.equal(belowMin.ok, false);
if (!belowMin.ok) {
  assert.equal(belowMin.code, 'COUPON_MIN_SUBTOTAL');
  assert.equal(belowMin.message, formatCouponMinSubtotalMessage(150));
  assert.equal(belowMin.message, 'Subtotal mínimo do cupom: R$ 150,00');
}

const percent = evaluateCoupon(base, 200, now);
assert.equal(percent.ok, true);
if (percent.ok) {
  assert.equal(percent.discount, 20);
  assert.equal(percent.finalSubtotal, 180);
}

const fixed = evaluateCoupon({ ...base, type: 'fixed', value: 30 }, 200, now);
assert.equal(fixed.ok, true);
if (fixed.ok) {
  assert.equal(fixed.discount, 30);
  assert.equal(fixed.finalSubtotal, 170);
}

const capped = evaluateCoupon({ ...base, type: 'fixed', value: 50 }, 40, now);
assert.equal(capped.ok, true);
if (capped.ok) {
  assert.equal(capped.discount, 40);
  assert.equal(capped.finalSubtotal, 0);
}

assert.equal(evaluateCoupon({ ...base, type: 'percent', value: 100 }, 99.9, now).ok, true);
if (evaluateCoupon({ ...base, type: 'percent', value: 100 }, 99.9, now).ok) {
  const full = evaluateCoupon({ ...base, type: 'percent', value: 100 }, 99.9, now);
  assert.equal(full.ok && full.discount, 99.9);
}

assert.equal(isPermanentCouponFailure('COUPON_INVALID'), true);
assert.equal(isPermanentCouponFailure('COUPON_EXPIRED'), true);
assert.equal(isPermanentCouponFailure('COUPON_MIN_SUBTOTAL'), false);

assert.equal(normalizeCouponCode('  schimitz10 '), 'SCHIMITZ10');
assert.ok(parseCouponDate('2026-09-20T00:00:00.000Z') instanceof Date);
assert.equal(parseCouponDate('not-a-date'), null);
assert.equal(parseCouponDate(null), null);

console.log('coupon evaluate helper tests ok');
