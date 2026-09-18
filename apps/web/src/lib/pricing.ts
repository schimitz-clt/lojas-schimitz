/** Storefront display helpers (PIX 5% + parcelamento). Backend authority: apps/api/src/common/pricing.ts — see docs/PIX-DISCOUNT.md */

export const PIX_DISCOUNT = 0.05;

/**
 * Display-side mirror of API `PIX_PROMO_COLLIDING_COUPON_CODES`.
 * When one of these is applied, do not preview a second automatic PIX 5%.
 */
export const PIX_PROMO_COLLIDING_COUPON_CODES = ['PIX5'] as const;

export function isPixPromoCollidingCouponCode(code: string | null | undefined): boolean {
  const n = String(code || '').trim().toUpperCase();
  if (!n) return false;
  return (PIX_PROMO_COLLIDING_COUPON_CODES as readonly string[]).includes(n);
}
/** Card Brick / checkout max installment options — not the interest-free marketing claim. */
export const MAX_INSTALLMENTS = 12;
/** Seller-absorbed Mercado Pago “Parcelado vendedor”. Only this many may be advertised as “sem juros”. */
export const INTEREST_FREE_INSTALLMENTS = 3;

export function toNumber(n: number | string | null | undefined): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export function pixPrice(price: number | string): number {
  return Math.round(toNumber(price) * (1 - PIX_DISCOUNT) * 100) / 100;
}

/** Display-only savings vs list/total when paying with PIX (presentation of server 5% rule). */
export function pixSavings(price: number | string): number {
  const base = toNumber(price);
  const savings = Math.round((base - pixPrice(base)) * 100) / 100;
  return Math.max(0, savings);
}

export function clampInstallments(n: number): number {
  return Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(n) || 1));
}

export function isInterestFreeInstallment(n: number): boolean {
  return clampInstallments(n) <= INTEREST_FREE_INSTALLMENTS;
}

/**
 * PT-BR suffix after “Nx de R$ …”.
 * 1x = à vista; 2–INTEREST_FREE = sem juros; above that may include buyer interest.
 */
export function installmentSuffix(n: number): string {
  const times = clampInstallments(n);
  if (times <= 1) return ' à vista';
  if (times <= INTEREST_FREE_INSTALLMENTS) return ' sem juros';
  return ' (podem incluir juros)';
}

/** Short marketing claim used on home/header/trust badges. */
export function interestFreeInstallmentClaim(): string {
  return `Até ${INTEREST_FREE_INSTALLMENTS}x sem juros`;
}

/** Honest footnote for the 1–MAX installment table. */
export function installmentTableNote(): string {
  return `Até ${INTEREST_FREE_INSTALLMENTS}x sem juros (a loja absorve o financiamento). De ${INTEREST_FREE_INSTALLMENTS + 1} a ${MAX_INSTALLMENTS}x, as parcelas podem incluir juros do Mercado Pago.`;
}

export function installmentValue(price: number | string, n = MAX_INSTALLMENTS): number {
  const times = clampInstallments(n);
  return Math.round((toNumber(price) / times) * 100) / 100;
}

export function installmentLine(price: number | string, n = INTEREST_FREE_INSTALLMENTS): string {
  const times = clampInstallments(n);
  const each = installmentValue(price, times);
  return `${times}x de ${each.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${installmentSuffix(times)}`;
}

export type StockTone = 'ok' | 'low' | 'out' | 'unknown';

export function stockBadge(stock: number | null | undefined): {
  label: string;
  tone: StockTone;
} | null {
  if (stock == null) return null;
  if (stock <= 0) return { label: 'Esgotado', tone: 'out' };
  if (stock <= 5) return { label: 'Últimas unidades', tone: 'low' };
  return null;
}
