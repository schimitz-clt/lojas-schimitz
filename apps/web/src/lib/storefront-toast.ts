/** Lightweight storefront toast (Portuguese). No network. */

export const STOREFRONT_TOAST_EVENT = 'sch-storefront-toast';

export type StorefrontToastTone = 'ok' | 'warn';

export type StorefrontToastPayload = {
  message: string;
  href?: string;
  hrefLabel?: string;
  tone?: StorefrontToastTone;
};

export function parseToastPayload(raw: unknown): StorefrontToastPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const message = typeof o.message === 'string' ? o.message.trim() : '';
  if (!message) return null;
  const href = typeof o.href === 'string' && o.href.trim() ? o.href.trim() : undefined;
  const hrefLabel =
    typeof o.hrefLabel === 'string' && o.hrefLabel.trim() ? o.hrefLabel.trim() : undefined;
  const tone: StorefrontToastTone = o.tone === 'warn' ? 'warn' : 'ok';
  return { message, href, hrefLabel, tone };
}

export function showStorefrontToast(payload: StorefrontToastPayload): void {
  const next = parseToastPayload(payload);
  if (!next || typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(STOREFRONT_TOAST_EVENT, { detail: next }));
  } catch {
    /* ignore */
  }
}
