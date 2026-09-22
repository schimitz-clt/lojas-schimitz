/**
 * Compact conversion cues for product cards (PIX / parcelas / frete).
 * Store-wide facts already shown in the topbar — not invented per SKU.
 */

import { INTEREST_FREE_INSTALLMENTS } from '@/lib/pricing';

export type CardCueId = 'pix' | 'install' | 'ship';

export type CardCue = {
  id: CardCueId;
  label: string;
  tone: CardCueId;
};

/** Short Portuguese chips — keep to 3 so cards stay uncluttered. */
export function productCardCues(): CardCue[] {
  return [
    { id: 'pix', label: 'PIX 5%', tone: 'pix' },
    { id: 'install', label: `${INTEREST_FREE_INSTALLMENTS}x s/ juros`, tone: 'install' },
    { id: 'ship', label: 'Frete POA', tone: 'ship' },
  ];
}

/** Card CTA — same Portuguese as the PDP sacola button. */
export function productCardAddLabel(opts: {
  outOfStock: boolean;
  adding: boolean;
  added: boolean;
  demo?: boolean;
}): string {
  if (opts.demo) return 'Não disponível';
  if (opts.outOfStock) return 'Ver detalhes';
  if (opts.adding) return 'Adicionando…';
  if (opts.added) return '✓ Na sacola';
  return 'Adicionar à sacola';
}

export function productCardKicker(
  categoryName?: string | null,
  sellerName?: string | null,
): string | null {
  const cat = (categoryName || '').trim();
  if (cat) return cat;
  const seller = (sellerName || '').trim();
  return seller || null;
}
