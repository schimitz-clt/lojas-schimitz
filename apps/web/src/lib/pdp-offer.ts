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

/** First-screen content order used by layout tests and mobile CSS comments. */
export function pdpMobileContentOrder(): string[] {
  return ['gallery', 'title', 'offers', 'price', 'description'];
}
