/** Backend pricing authority (PIX 5%). Storefront `apps/web/src/lib/pricing.ts` is display-only. */

export const PIX_DISCOUNT_RATE = 0.05;

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Amount charged for PIX = 95% of checkout total (after coupon/cashback/freight). */
export function pixChargeAmount(orderTotal: number): number {
  return roundMoney(Number(orderTotal) * (1 - PIX_DISCOUNT_RATE));
}

export function pixDiscountAmount(orderTotal: number): number {
  const total = roundMoney(orderTotal);
  return roundMoney(total - pixChargeAmount(total));
}
