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
};

export function ProductShareButton({ productName }: Props) {
  const [status, setStatus] = useState('');

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
    <span className="pdp-share">
      <button type="button" className="btn ghost pdp-share-btn" onClick={onShare}>
        {pdpShareButtonLabel()}
      </button>
      {status ? (
        <span className="pdp-share-status" role="status">
          {status}
        </span>
      ) : null}
    </span>
  );
}
