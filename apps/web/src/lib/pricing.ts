/** Storefront display helpers (PIX 5% + parcelamento). Backend authority: apps/api/src/common/pricing.ts — see docs/PIX-DISCOUNT.md */

import { LOW_STOCK_LABEL, shouldShowLowStock } from '@/lib/low-stock';

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
/**
 * Quantas parcelas a loja destaca no marketing (“parcele em até 12x no cartão”, igual ao maxInstallments do Card Brick).
 * NÃO é promessa de parcelamento sem juros: os juros de cada parcelamento são definidos pelo
 * Mercado Pago conforme o cartão (consulta de 09/10/2026: 2x = 9,64%, 3x = 11,23%).
 * Só volte a falar em “sem juros” depois de confirmar no painel do Mercado Pago (e atualizar o spec).
 */
export const CARD_INSTALLMENTS_HIGHLIGHT = MAX_INSTALLMENTS;

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

/** Aviso curto e único sobre juros (produto, checkout, termos, suporte, tabela de parcelas). */
export const INSTALLMENT_INTEREST_NOTE = 'Juros conforme o cartão, informados no checkout.';

/**
 * PT-BR suffix after “Nx de R$ …”. 1x = à vista; acima disso o valor é só a divisão do preço
 * (valor base): o total real depende do cartão.
 */
export function installmentSuffix(n: number): string {
  const times = clampInstallments(n);
  if (times <= 1) return ' à vista';
  return ' (valor base; juros conforme o cartão)';
}

/**
 * The ONLY place the card-installment marketing phrase is written. Every storefront text must use
 * these helpers (or CARD_INSTALLMENTS_HIGHLIGHT) — see installment-claim.spec.ts.
 */
/** “12x no cartão” (no “até”), for chips/lists that already set the context. */
export function cardInstallmentShort(): string {
  return `${CARD_INSTALLMENTS_HIGHLIGHT}x no cartão`;
}

/** “parcele em até 12x no cartão”, lower case, for use inside sentences. */
export function cardInstallmentPhrase(): string {
  return `parcele em até ${CARD_INSTALLMENTS_HIGHLIGHT}x no cartão`;
}

/** Short marketing claim used on home/header/trust badges: “Parcele em até 12x no cartão”. */
export function cardInstallmentClaim(): string {
  return `Parcele em até ${CARD_INSTALLMENTS_HIGHLIGHT}x no cartão`;
}

/** Honest footnote for the 1–MAX installment table. */
export function installmentTableNote(): string {
  return `${cardInstallmentClaim()} pelo Mercado Pago. ${INSTALLMENT_INTEREST_NOTE}`;
}

export function installmentValue(price: number | string, n = MAX_INSTALLMENTS): number {
  const times = clampInstallments(n);
  return Math.round((toNumber(price) / times) * 100) / 100;
}

/**
 * Linha curta de parcelamento (cards, PDP, carrinho). Acima de 1x NÃO mostra valor de parcela:
 * a parcela real inclui os juros do cartão, que só o Mercado Pago sabe.
 */
export function installmentLine(price: number | string, n = CARD_INSTALLMENTS_HIGHLIGHT): string {
  const times = clampInstallments(n);
  if (times <= 1) {
    return `1x de ${installmentValue(price, 1).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${installmentSuffix(1)}`;
  }
  return `Parcele em até ${times}x no cartão`;
}

export type StockTone = 'ok' | 'low' | 'out' | 'unknown';

export function stockBadge(stock: number | null | undefined): {
  label: string;
  tone: StockTone;
} | null {
  if (stock == null) return null;
  if (typeof stock !== 'number' || !Number.isFinite(stock)) return null;
  if (stock <= 0) return { label: 'Esgotado', tone: 'out' };
  if (shouldShowLowStock(stock)) return { label: LOW_STOCK_LABEL, tone: 'low' };
  return null;
}
