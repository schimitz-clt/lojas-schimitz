'use client';

import { useState } from 'react';
import {
  pdpShareButtonLabel,
  pdpShareCopiedLabel,
  pdpShareWhatsAppHref,
  shareProductPage,
} from '@/lib/pdp-share';

type Props = {
  productName: string;
  variant?: 'text' | 'icon';
};

export function ProductShareButton({ productName, variant = 'text' }: Props) {
  const [status, setStatus] = useState('');
  const icon = variant === 'icon';

  async function onShare() {
    const url = typeof window !== 'undefined' ? window.location.href.split('#')[0] : '';
    const canShareNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    const result = await shareProductPage({
      productName,
      url,
      canShareNative,
      shareNative: canShareNative ? (data) => navigator.share(data) : undefined,
      copyText:
        typeof navigator !== 'undefined' && navigator.clipboard?.writeText
          ? (text) => navigator.clipboard.writeText(text)
          : undefined,
    });
    if (result === 'copied') {
      setStatus(pdpShareCopiedLabel());
      window.setTimeout(() => setStatus(''), 2500);
      return;
    }
    if (result === 'whatsapp') {
      window.open(pdpShareWhatsAppHref(productName, url), '_blank', 'noopener,noreferrer');
      return;
    }
    if (result === 'failed') setStatus('Não foi possível compartilhar');
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
        {icon ? (
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M18 8a3 3 0 1 0-2.83-4H15c.03.2.05.4.05.6L8.7 8.2a3 3 0 1 0 0 7.6l6.35 3.6A3 3 0 1 0 16.8 18l-6.35-3.6a3 3 0 0 0 0-2.8L16.8 8c.1.13.22.25.35.35A3 3 0 0 0 18 8z"
            />
          </svg>
        ) : (
          pdpShareButtonLabel()
        )}
      </button>
      {status ? (
        <span className="pdp-share-status" role="status">
          {status}
        </span>
      ) : null}
    </span>
  );
}
