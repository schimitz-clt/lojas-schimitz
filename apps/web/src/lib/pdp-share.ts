/**
 * PDP share — Web Share API, then copy, then WhatsApp (wa.me text).
 * Portuguese copy only. No analytics.
 * Share URL is always the live apex product page, never localhost / www / query.
 */

export const PDP_SHARE_ORIGIN = 'https://lojasschimitz.com.br';

export type PdpSharePayload = {
  title: string;
  text: string;
  url: string;
};

export type PdpShareResult = 'shared' | 'copied' | 'whatsapp' | 'cancelled' | 'failed';

/** Canonical PDP URL customers should share (apex, no query/hash). */
export function pdpProductCanonicalUrl(slug: string): string {
  const s = (slug || '').trim().replace(/^\/+|\/+$/g, '');
  if (!s || s.includes('/') || s.includes('..') || s.includes('?') || s.includes('#')) return '';
  return `${PDP_SHARE_ORIGIN}/produto/${encodeURIComponent(s)}`;
}

export function pdpSharePayload(productName: string, url: string): PdpSharePayload {
  const name = (productName || '').trim() || 'Produto';
  const href = (url || '').trim();
  return {
    title: name,
    text: 'Olha este produto na Lojas Schimitz',
    url: href,
  };
}

/** Opens the user's WhatsApp with product title + link (no store number). */
export function pdpShareWhatsAppHref(productName: string, url: string): string {
  const { title, text } = pdpSharePayload(productName, url);
  const href = (url || '').trim();
  const body = href ? `${title}\n${text}\n${href}` : `${title}\n${text}`;
  return `https://wa.me/?text=${encodeURIComponent(body)}`;
}

export function pdpShareCopiedLabel(): string {
  return 'Link copiado';
}

export function pdpShareButtonLabel(): string {
  return 'Compartilhar';
}

type ShareNative = (data: PdpSharePayload) => Promise<void>;
type CopyText = (text: string) => Promise<void>;

/** Prefer native share → clipboard → WhatsApp. AbortError stays cancelled. */
export async function shareProductPage(opts: {
  productName: string;
  url: string;
  canShareNative: boolean;
  shareNative?: ShareNative;
  copyText?: CopyText;
}): Promise<PdpShareResult> {
  const payload = pdpSharePayload(opts.productName, opts.url);
  if (!payload.url) return 'failed';

  if (opts.canShareNative && opts.shareNative) {
    try {
      await opts.shareNative(payload);
      return 'shared';
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'AbortError') return 'cancelled';
    }
  }

  if (opts.copyText) {
    try {
      await opts.copyText(payload.url);
      return 'copied';
    } catch {
      /* fall through to WhatsApp */
    }
  }

  return 'whatsapp';
}
