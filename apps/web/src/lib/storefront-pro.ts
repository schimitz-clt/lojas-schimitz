/**
 * Storefront PROFESSIONAL Phase 1 — pure display helpers.
 * No network, no DOM. Pricing math stays in @/lib/pricing (5% PIX authority).
 */

import { pixPrice, pixSavings, toNumber } from '@/lib/pricing';

/** Percent off vs compare-at; null when no real discount. */
export function discountPercent(
  price: number | string,
  compareAt?: number | string | null,
): number | null {
  const p = toNumber(price);
  const cmp = toNumber(compareAt);
  if (!cmp || cmp <= p || p <= 0) return null;
  return Math.round((1 - p / cmp) * 100);
}

export type PixHighlight = {
  list: number;
  pix: number;
  savings: number;
  /** Short Portuguese tag, e.g. "5% OFF" */
  tag: string;
  /** One-line Portuguese hint for cart/PDP */
  savingsLine: string;
};

/** PIX price hierarchy for cards / PDP / cart summary (display only). */
export function pixHighlight(listPrice: number | string): PixHighlight {
  const list = toNumber(listPrice);
  const pix = pixPrice(list);
  const savings = pixSavings(list);
  return {
    list,
    pix,
    savings,
    tag: '5% OFF',
    savingsLine:
      savings > 0
        ? `Economize ${savings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} no PIX`
        : '5% de desconto no PIX',
  };
}

export type CartTrustItem = {
  title: string;
  sub: string;
};

/** Honest trust lines for cart summary (no invented seals). */
export function cartTrustItems(): CartTrustItem[] {
  return [
    { title: 'PIX 5% off', sub: 'Desconto aplicado no pagamento' },
    { title: 'Frete POA', sub: 'Grátis em Porto Alegre' },
    { title: 'Troca 7 dias', sub: 'Direito a arrependimento' },
  ];
}

export type StickyBuyState = {
  outOfStock: boolean;
  adding: boolean;
  addedToBag: boolean;
};

/** Mobile sticky CTA label — Portuguese, deterministic. */
export function stickyBuyLabel(state: StickyBuyState): string {
  if (state.outOfStock) return 'Indisponível';
  if (state.adding) return 'Adicionando...';
  if (state.addedToBag) return 'Ir para a sacola';
  return 'Adicionar à sacola';
}

/** Cart primary CTA label. */
export function cartCheckoutLabel(loggedIn: boolean): string {
  return loggedIn ? 'Finalizar compra' : 'Entrar e finalizar';
}
