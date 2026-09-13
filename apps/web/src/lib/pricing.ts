/** Storefront display helpers (PIX 5% + parcelamento). Backend authority: apps/api/src/common/pricing.ts — see docs/PIX-DISCOUNT.md */

export const PIX_DISCOUNT = 0.05;
export const MAX_INSTALLMENTS = 12;

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

export function installmentValue(price: number | string, n = MAX_INSTALLMENTS): number {
  const times = Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(n) || 1));
  return Math.round((toNumber(price) / times) * 100) / 100;
}

export function installmentLine(price: number | string, n = MAX_INSTALLMENTS): string {
  const times = Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(n) || 1));
  const each = installmentValue(price, times);
  return `${times}x de ${each.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} sem juros`;
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
