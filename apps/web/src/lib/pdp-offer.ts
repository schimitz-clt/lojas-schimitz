/**
 * PDP offer/description helpers — presentation only.
 * PIX 5% and 3x sem juros stay in @/lib/pricing (do not invent payment math).
 */

import { interestFreeInstallmentClaim } from '@/lib/pricing';

/** Trimmed Admin description; empty/whitespace → "" so the block can hide. */
export function productDescriptionText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

export type PdpOfferPill = {
  id: 'pix' | 'install';
  label: string;
  tone: 'pix' | 'install';
};

/** Visible buybox chips (Pix 5% + até 3x sem juros). */
export function pdpOfferPills(): PdpOfferPill[] {
  return [
    { id: 'pix', label: 'Pix 5%', tone: 'pix' },
    { id: 'install', label: interestFreeInstallmentClaim(), tone: 'install' },
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
