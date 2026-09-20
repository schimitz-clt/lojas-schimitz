import { couponDiscountAmount, normalizeCouponCode } from '../../common/pricing';

export type CouponEvalErrorCode =
  | 'COUPON_INVALID'
  | 'COUPON_NOT_STARTED'
  | 'COUPON_EXPIRED'
  | 'COUPON_EXHAUSTED'
  | 'COUPON_MIN_SUBTOTAL';

export type CouponEvalInput = {
  code?: string | null;
  type: string;
  value: number;
  active: boolean;
  minSubtotal?: number | null;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  maxUses?: number | null;
  usedCount?: number;
  reservedCount?: number;
};

export type CouponEvalOk = {
  ok: true;
  discount: number;
  finalSubtotal: number;
};

export type CouponEvalFail = {
  ok: false;
  code: CouponEvalErrorCode;
  message: string;
};

export type CouponEvalResult = CouponEvalOk | CouponEvalFail;

export function parseCouponDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatCouponMinSubtotalMessage(min: number): string {
  return `Subtotal mínimo do cupom: R$ ${Number(min).toFixed(2).replace('.', ',')}`;
}

/** Pure coupon gate — no I/O. CouponsService.validate is the DB wrapper. */
export function evaluateCoupon(
  coupon: CouponEvalInput | null | undefined,
  subtotal: number,
  now: Date = new Date(),
): CouponEvalResult {
  if (!coupon || !coupon.active) {
    return { ok: false, code: 'COUPON_INVALID', message: 'Cupom inválido' };
  }
  const startsAt = parseCouponDate(coupon.startsAt);
  if (startsAt && startsAt > now) {
    return { ok: false, code: 'COUPON_NOT_STARTED', message: 'Cupom ainda não válido' };
  }
  const endsAt = parseCouponDate(coupon.endsAt);
  if (endsAt && endsAt < now) {
    return { ok: false, code: 'COUPON_EXPIRED', message: 'Cupom expirado' };
  }
  const used = Number(coupon.usedCount || 0);
  const reserved = Number(coupon.reservedCount || 0);
  if (coupon.maxUses != null && used + reserved >= coupon.maxUses) {
    return { ok: false, code: 'COUPON_EXHAUSTED', message: 'Cupom esgotado' };
  }
  const min = coupon.minSubtotal == null ? 0 : Number(coupon.minSubtotal);
  if (min && subtotal < min) {
    return {
      ok: false,
      code: 'COUPON_MIN_SUBTOTAL',
      message: formatCouponMinSubtotalMessage(min),
    };
  }

  const type = coupon.type === 'percent' ? 'percent' : 'fixed';
  const discount = couponDiscountAmount(type, Number(coupon.value), subtotal);
  return {
    ok: true,
    discount,
    finalSubtotal: Math.round((Number(subtotal) - discount) * 100) / 100,
  };
}

export function isPermanentCouponFailure(code: CouponEvalErrorCode): boolean {
  return code !== 'COUPON_MIN_SUBTOTAL';
}

export { normalizeCouponCode };
