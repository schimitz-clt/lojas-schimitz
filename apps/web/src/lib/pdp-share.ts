/**
 * PDP share — Web Share API (title + text + url), then clipboard of the same
 * rich text, then WhatsApp (wa.me text). Portuguese copy only. No analytics.
 * Share URL is always the live apex product page, never localhost / www / query.
 * WhatsApp here is share-to-a-contact (no store number).
 */

import { pixPrice } from '@/lib/pricing';

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

/**
 * Formatted PIX price for share copy, or null when there is nothing to advertise.
 * Uses the existing 5% display helper — does not invent a second discount.
 */
export function pdpSharePixLabel(price: number | string | null | undefined): string | null {
  if (price == null || price === '') return null;
  const base = typeof price === 'number' ? price : Number(String(price).trim());
  if (!Number.isFinite(base) || base <= 0) return null;
  const pix = pixPrice(base);
  if (!Number.isFinite(pix) || pix <= 0) return null;
  return pix.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function pdpSharePayload(
  productName: string,
  url: string,
  pixLabel?: string | null,
): PdpSharePayload {
  const name = (productName || '').trim() || 'Produto';
  const href = (url || '').trim();
  const pix = (pixLabel || '').trim();
  const text = pix
    ? `Olha este produto na Lojas Schimitz por ${pix} no PIX`
    : 'Olha este produto na Lojas Schimitz';
  return {
    title: name,
    text,
    url: href,
  };
}

/** Same message native share describes: name, pitch (with PIX when present), and URL. */
export function pdpShareClipboardText(payload: PdpSharePayload): string {
  const title = (payload.title || '').trim();
  const text = (payload.text || '').trim();
  const url = (payload.url || '').trim();
  return [title, text, url].filter(Boolean).join('\n');
}

/** Opens the user's WhatsApp with product title + link (no store number). */
export function pdpShareWhatsAppHref(
  productName: string,
  url: string,
  pixLabel?: string | null,
): string {
  const payload = pdpSharePayload(productName, url, pixLabel);
  return `https://wa.me/?text=${encodeURIComponent(pdpShareClipboardText(payload))}`;
}

export function pdpShareCopiedLabel(): string {
  return 'Texto copiado';
}

export function pdpShareButtonLabel(): string {
  return 'Compartilhar';
}

export function pdpWhatsAppShareLabel(): string {
  return 'Compartilhar no WhatsApp';
}

type ShareNative = (data: PdpSharePayload) => Promise<void>;
type CopyText = (text: string) => Promise<void>;

/** Prefer native share → clipboard of the rich text → WhatsApp. AbortError stays cancelled. */
export async function shareProductPage(opts: {
  productName: string;
  url: string;
  pixLabel?: string | null;
  canShareNative: boolean;
  shareNative?: ShareNative;
  copyText?: CopyText;
}): Promise<PdpShareResult> {
  const payload = pdpSharePayload(opts.productName, opts.url, opts.pixLabel);
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
      await opts.copyText(pdpShareClipboardText(payload));
      return 'copied';
    } catch {
      /* fall through to WhatsApp */
    }
  }

  return 'whatsapp';
}
