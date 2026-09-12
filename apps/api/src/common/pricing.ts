/** Backend pricing authority (PIX 5% + checkout totals). Storefront `apps/web/src/lib/pricing.ts` is display-only. */

export const PIX_DISCOUNT_RATE = 0.05;

/** Money comparison tolerance (R$ 0.01). */
export const MONEY_EPS = 0.009;

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function moneyEquals(a: number, b: number, eps = MONEY_EPS): boolean {
  return Math.abs(roundMoney(a) - roundMoney(b)) <= eps;
}

/** Amount charged for PIX = 95% of checkout total (after coupon/cashback/freight). */
export function pixChargeAmount(orderTotal: number): number {
  return roundMoney(Number(orderTotal) * (1 - PIX_DISCOUNT_RATE));
}

export function pixDiscountAmount(orderTotal: number): number {
  const total = roundMoney(orderTotal);
  return roundMoney(total - pixChargeAmount(total));
}

export type CouponDiscountType = 'percent' | 'fixed';

/** Pure coupon discount math (mirrors CouponsService.validate numbers). */
export function couponDiscountAmount(
  type: CouponDiscountType,
  value: number,
  subtotal: number,
): number {
  const sub = roundMoney(subtotal);
  let discount = type === 'percent' ? sub * (Number(value) / 100) : Number(value);
  discount = Math.min(discount, sub);
  return roundMoney(discount);
}

export type CheckoutTotalsInput = {
  /** Line items: unit price × qty (pre-summed ok via lineSubtotals). */
  lineSubtotals?: number[];
  /** Or pass a precomputed raw subtotal (will be rounded). */
  subtotal?: number;
  couponDiscount?: number;
  cashbackUsed?: number;
  freight?: number;
};

export type CheckoutTotals = {
  subtotal: number;
  couponDiscount: number;
  cashbackUsed: number;
  freight: number;
  /** coupon + cashback */
  totalDiscount: number;
  /** max(0, subtotal - discounts + freight) — checkout authority before PIX */
  total: number;
  /** PIX charge = 95% of total */
  pixCharge: number;
  pixDiscount: number;
};

/**
 * Backend authority for order money fields at create time.
 * Formula: total = max(0, subtotal − coupon − cashback + freight).
 * PIX 5% is applied later at payment intent / approve — not here.
 */
export function computeCheckoutTotals(input: CheckoutTotalsInput): CheckoutTotals {
  const rawSub =
    input.subtotal != null
      ? Number(input.subtotal)
      : (input.lineSubtotals || []).reduce((s, n) => s + Number(n || 0), 0);
  const subtotal = roundMoney(rawSub);
  const couponDiscount = roundMoney(Math.min(Math.max(0, Number(input.couponDiscount || 0)), subtotal));
  const maxCashback = Math.max(0, subtotal - couponDiscount);
  const cashbackUsed = roundMoney(Math.min(Math.max(0, Number(input.cashbackUsed || 0)), maxCashback));
  const freight = roundMoney(Math.max(0, Number(input.freight || 0)));
  const totalDiscount = roundMoney(couponDiscount + cashbackUsed);
  const total = roundMoney(Math.max(0, subtotal - totalDiscount + freight));
  return {
    subtotal,
    couponDiscount,
    cashbackUsed,
    freight,
    totalDiscount,
    total,
    pixCharge: pixChargeAmount(total),
    pixDiscount: pixDiscountAmount(total),
  };
}

/**
 * Webhook / approve amount gate.
 * Intent `payment.amount` is authority (PIX may be 95% of order.total).
 * Also accept order.total when it matches (card / non-PIX) for backward compatibility.
 */
export function amountsMatchForApprove(opts: {
  providerAmount: number;
  paymentAmount: number;
  orderTotal: number;
}): boolean {
  const got = Number(opts.providerAmount);
  if (moneyEquals(got, Number(opts.paymentAmount))) return true;
  if (moneyEquals(got, Number(opts.orderTotal))) return true;
  return false;
}
