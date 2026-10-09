/**
 * PDP offer/description helpers — presentation only.
 * PIX 5% and the card-installment highlight stay in @/lib/pricing (do not invent payment math).
 */

import { cardInstallmentClaim, cardInstallmentPhrase } from '@/lib/pricing';
import { publicProductDescription } from '@/lib/public-copy';

/** Trimmed Admin description; QA/homologation phrasing is replaced, never invented specs. */
export function productDescriptionText(
  raw: unknown,
  meta?: { name?: string | null; categoryName?: string | null },
): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return publicProductDescription({
    description: trimmed,
    name: meta?.name,
    categoryName: meta?.categoryName,
  });
}

export type PdpOfferPill = {
  id: 'pix' | 'install';
  label: string;
  tone: 'pix' | 'install';
};

/** Visible buybox chips (Pix 5% + parcele em até 3x no cartão). */
export function pdpOfferPills(): PdpOfferPill[] {
  return [
    { id: 'pix', label: 'Pix 5%', tone: 'pix' },
    { id: 'install', label: cardInstallmentClaim(), tone: 'install' },
  ];
}

/**
 * Magalu-style mobile stack (alignment rhythm only — Schimitz branding stays):
 * gallery → name + rating → model → seller → price/PIX/parcelas → description → stock → CTAs.
 */
export function pdpMobileContentOrder(): string[] {
  return ['gallery', 'title', 'rating', 'model', 'seller', 'price', 'description', 'stock', 'ctas'];
}

/** Long Admin specs get a “Ver descrição completa” fold on mobile. */
export const PDP_DESC_PREVIEW_CHARS = 360;

export function pdpDescriptionNeedsCollapse(text: string): boolean {
  return productDescriptionText(text).length > PDP_DESC_PREVIEW_CHARS;
}

export type PdpFact = { id: string; label: string; value: string };

/** Buybox answers using only data already on the page. No invented freight day. */
export function pdpDecisionFacts(input: {
  stockLabel: string;
  sellerName?: string | null;
}): PdpFact[] {
  const seller = String(input.sellerName || '').trim();
  return [
    { id: 'stock', label: 'Disponibilidade', value: input.stockLabel },
    { id: 'pay', label: 'Pagamento', value: `PIX 5% off e ${cardInstallmentPhrase()} no checkout` },
    {
      id: 'ship',
      label: 'Entrega',
      value: 'Calcule o CEP nesta página. Frete grátis em Porto Alegre conforme a regra vigente.',
    },
    ...(seller ? [{ id: 'seller', label: 'Vendido por', value: seller }] : []),
  ];
}
