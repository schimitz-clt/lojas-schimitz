'use client';

import {
  pdpProductCanonicalUrl,
  pdpShareButtonLabel,
  pdpShareCopiedLabel,
  pdpSharePayload,
  pdpShareWhatsAppHref,
  pdpWhatsAppShareLabel,
  shareProductPage,
} from '@/lib/pdp-share';
import { showStorefrontToast } from '@/lib/storefront-toast';

type Props = {
  productName: string;
  productSlug: string;
  /** Preformatted PIX price (e.g. "R$ 854,05"). Omitted when the product has no price. */
  pixLabel?: string | null;
  variant?: 'text' | 'icon';
};

function canUseNativeShare(payload: { title: string; text: string; url: string }): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare === 'function') {
    try {
      return navigator.canShare(payload);
    } catch {
      return true;
    }
  }
  return true;
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18 8a3 3 0 1 0-2.83-4H15c.03.2.05.4.05.6L8.7 8.2a3 3 0 1 0 0 7.6l6.35 3.6A3 3 0 1 0 16.8 18l-6.35-3.6a3 3 0 0 0 0-2.8L16.8 8c.1.13.22.25.35.35A3 3 0 0 0 18 8z"
      />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L0 24l6.33-1.66a11.9 11.9 0 0 0 5.72 1.46h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.16-3.44-8.42zM12.06 21.8h-.01a9.88 9.88 0 0 1-5.03-1.38l-.36-.21-3.76.98 1-3.66-.24-.38a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.9-9.87 9.9zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z"
      />
    </svg>
  );
}

export function ProductShareButton({ productName, productSlug, pixLabel, variant = 'text' }: Props) {
  const icon = variant === 'icon';

  async function onShare(e: { preventDefault(): void; stopPropagation(): void }) {
    e.preventDefault();
    e.stopPropagation();
    const url = pdpProductCanonicalUrl(productSlug);
    const payload = pdpSharePayload(productName, url, pixLabel);
    const canShareNative = canUseNativeShare(payload);
    const result = await shareProductPage({
      productName,
      url,
      pixLabel,
      canShareNative,
      shareNative: canShareNative ? (data) => navigator.share(data) : undefined,
      copyText:
        typeof navigator !== 'undefined' && navigator.clipboard?.writeText
          ? (text) => navigator.clipboard.writeText(text)
          : undefined,
    });
    if (result === 'copied') {
      showStorefrontToast({ message: pdpShareCopiedLabel() });
      return;
    }
    if (result === 'whatsapp') {
      window.open(pdpShareWhatsAppHref(productName, url, pixLabel), '_blank', 'noopener,noreferrer');
      return;
    }
    if (result === 'failed') {
      showStorefrontToast({ message: 'Não foi possível compartilhar', tone: 'warn' });
    }
  }

  return (
    <span className={`pdp-share${icon ? ' pdp-share-icon' : ''}`}>
      <button
        type="button"
        className="btn ghost pdp-share-btn"
        onClick={onShare}
        aria-label={pdpShareButtonLabel()}
        title={pdpShareButtonLabel()}
      >
        {icon ? <ShareIcon /> : pdpShareButtonLabel()}
      </button>
    </span>
  );
}

/** Direct WhatsApp share (contact picker). Does not message the store number. */
export function ProductWhatsAppShareButton({
  productName,
  productSlug,
  pixLabel,
  variant = 'icon',
}: Props) {
  const icon = variant === 'icon';
  const url = pdpProductCanonicalUrl(productSlug);
  const href = url ? pdpShareWhatsAppHref(productName, url, pixLabel) : '';

  return (
    <span className={`pdp-wa-share${icon ? ' pdp-wa-share-icon' : ''}`}>
      <a
        className="btn ghost pdp-wa-share-btn"
        href={href || undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={pdpWhatsAppShareLabel()}
        title={pdpWhatsAppShareLabel()}
        data-testid="pdp-whatsapp-share"
        onClick={(e) => {
          e.stopPropagation();
          if (!href) {
            e.preventDefault();
            showStorefrontToast({ message: 'Não foi possível compartilhar', tone: 'warn' });
          }
        }}
      >
        <WhatsAppIcon />
        {icon ? null : <span className="pdp-wa-share-txt">WhatsApp</span>}
      </a>
    </span>
  );
}
