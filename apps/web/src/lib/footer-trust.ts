/**
 * Compact storefront footer trust — PIX/cartão, WhatsApp, entrega.
 * Facts already used on the vitrine. No invented seals or viewer counts.
 */

import { INTEREST_FREE_INSTALLMENTS, PIX_DISCOUNT } from '@/lib/pricing';

export type FooterTrustItemId = 'pay' | 'whatsapp' | 'delivery';

export type FooterTrustItem = {
  id: FooterTrustItemId;
  title: string;
  body: string;
  href?: string;
  external?: boolean;
};

export const FOOTER_TRUST_WHATSAPP_FALLBACK = '(51) 99625-3766';

export function footerTrustItems(opts?: {
  whatsappHref?: string | null;
  whatsappDisplay?: string | null;
}): FooterTrustItem[] {
  const pixPct = Math.round(PIX_DISCOUNT * 100);
  const waDisplay = String(opts?.whatsappDisplay || '').trim() || FOOTER_TRUST_WHATSAPP_FALLBACK;
  const waHref = String(opts?.whatsappHref || '').trim();

  return [
    {
      id: 'pay',
      title: 'PIX e cartão',
      body: `PIX ${pixPct}% off · até ${INTEREST_FREE_INSTALLMENTS}x sem juros`,
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp atendimento',
      body: waDisplay,
      href: waHref || undefined,
      external: Boolean(waHref),
    },
    {
      id: 'delivery',
      title: 'Entrega e segurança',
      body: 'Frete grátis em POA · pagamento pelo Mercado Pago',
    },
  ];
}
