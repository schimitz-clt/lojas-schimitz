/** Backend pricing authority (PIX 5% + checkout totals). Storefront `apps/web/src/lib/pricing.ts` is display-only. */

export const PIX_DISCOUNT_RATE = 0.05;

/**
 * Coupon codes that duplicate the automatic PIX 5% payment promo.
 * If an order already used one of these, PIX `createIntent` must NOT apply
 * `pixChargeAmount` again (that would stack ~10%). Card intents are unchanged.
 *
 * Optional extra codes: comma-separated `PIX_PROMO_COLLIDING_COUPON_CODES` env.
 * Seed coupon `PIX5` is retired (inactive) — treat as colliding if still attached.
 */
export const PIX_PROMO_COLLIDING_COUPON_CODES = ['PIX5'] as const;

export function normalizeCouponCode(code: string | null | undefined): string {
  return String(code || '').trim().toUpperCase();
}

/** Built-in list plus optional CSV env (`PIX_PROMO_COLLIDING_COUPON_CODES`). */
export function collidingPixPromoCouponCodes(extraCsv?: string | null): string[] {
  const csv =
    extraCsv === undefined ? process.env.PIX_PROMO_COLLIDING_COUPON_CODES || '' : extraCsv || '';
  const seen = new Set<string>(PIX_PROMO_COLLIDING_COUPON_CODES);
  for (const raw of String(csv).split(',')) {
    const code = normalizeCouponCode(raw);
    if (code) seen.add(code);
  }
  return [...seen];
}

export function isPixPromoCollidingCouponCode(
  code: string | null | undefined,
  extraCsv?: string | null,
): boolean {
  const n = normalizeCouponCode(code);
  if (!n) return false;
  return collidingPixPromoCouponCodes(extraCsv).includes(n);
}

/**
 * PIX intent charge after coupon/cashback/freight.
 * Colliding coupon (e.g. PIX5) already reduced `order.total` — skip automatic 5%.
 * Unrelated coupons still get automatic PIX 5% on the post-coupon total.
 */
export function pixIntentChargeAmount(
  orderTotal: number,
  couponCode?: string | null,
): number {
  const total = roundMoney(Number(orderTotal));
  if (isPixPromoCollidingCouponCode(couponCode)) return total;
  return pixChargeAmount(total);
}

/** Card Brick / checkout max installment options — not the interest-free marketing claim. */
export const MAX_INSTALLMENTS = 12;
/** Seller-absorbed Mercado Pago “Parcelado vendedor”. Only this many may be advertised as “sem juros”. */
export const INTEREST_FREE_INSTALLMENTS = 3;

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
  /** When set and colliding with PIX promo, `pixCharge` == `total` (no second 5%). */
  couponCode?: string | null;
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
  /** PIX charge preview — 95% of total, or total when couponCode collides with PIX promo */
  pixCharge: number;
  pixDiscount: number;
};

/**
 * Backend authority for order money fields at create time.
 * Formula: total = max(0, subtotal − coupon − cashback + freight).
 * PIX 5% is applied later at payment intent / approve — not here,
 * except `pixCharge`/`pixDiscount` preview skips automatic PIX when `couponCode`
 * collides with the PIX promo (intent-time is the real gate; see pixIntentChargeAmount).
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
  const pixCharge = pixIntentChargeAmount(total, input.couponCode);
  return {
    subtotal,
    couponDiscount,
    cashbackUsed,
    freight,
    totalDiscount,
    total,
    pixCharge,
    pixDiscount: roundMoney(total - pixCharge),
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
