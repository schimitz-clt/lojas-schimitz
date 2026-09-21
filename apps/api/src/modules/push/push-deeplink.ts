/**
 * Map campaign link/path → storefront URL the Android WebView may open.
 * Pure. Never allows javascript:/file:/intent: or third-party hosts.
 */

export const STOREFRONT_ORIGIN = 'https://lojasschimitz.com.br';
export const STOREFRONT_WWW_ORIGIN = 'https://www.lojasschimitz.com.br';

const ALLOWED_HOSTS = new Set(['lojasschimitz.com.br', 'www.lojasschimitz.com.br']);

export type DeepLinkMapResult = {
  ok: boolean;
  path: string;
  url: string | null;
  reason?: string;
};

function stripHash(s: string): string {
  const i = s.indexOf('#');
  return i >= 0 ? s.slice(0, i) : s;
}

/** Normalize admin/input path: relative `/produto/x` or full same-origin HTTPS. */
export function normalizePushLinkPath(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '/';
  return s;
}

export function isAllowedStorefrontHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (!h) return false;
  return ALLOWED_HOSTS.has(h);
}

/**
 * Resolve a campaign link to a same-origin HTTPS URL + path.
 * Rejects schemes that must never enter the WebView.
 */
export function mapPushDeepLink(raw: unknown, origin = STOREFRONT_ORIGIN): DeepLinkMapResult {
  const input = normalizePushLinkPath(raw);
  const lower = input.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('intent:') ||
    lower.startsWith('content:') ||
    lower.startsWith('vbscript:')
  ) {
    return { ok: false, path: '/', url: null, reason: 'scheme_forbidden' };
  }

  if (/^https?:\/\//i.test(input)) {
    let parsed: URL;
    try {
      parsed = new URL(stripHash(input));
    } catch {
      return { ok: false, path: '/', url: null, reason: 'url_invalid' };
    }
    if (parsed.protocol !== 'https:') {
      return { ok: false, path: '/', url: null, reason: 'https_required' };
    }
    if (!isAllowedStorefrontHost(parsed.hostname)) {
      return { ok: false, path: '/', url: null, reason: 'host_forbidden' };
    }
    const path = `${parsed.pathname || '/'}${parsed.search || ''}` || '/';
    const canonical = `${STOREFRONT_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
    return { ok: true, path, url: canonical };
  }

  if (input.startsWith('//')) {
    return { ok: false, path: '/', url: null, reason: 'protocol_relative' };
  }

  const path = input.startsWith('/') ? input : `/${input}`;
  if (path.includes('://')) {
    return { ok: false, path: '/', url: null, reason: 'embedded_scheme' };
  }
  const base = origin.replace(/\/$/, '') || STOREFRONT_ORIGIN;
  let url: string;
  try {
    url = new URL(stripHash(path), `${base}/`).toString();
  } catch {
    return { ok: false, path: '/', url: null, reason: 'path_invalid' };
  }
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !isAllowedStorefrontHost(parsed.hostname)) {
    return { ok: false, path: '/', url: null, reason: 'host_forbidden' };
  }
  const outPath = `${parsed.pathname || '/'}${parsed.search || ''}` || '/';
  return { ok: true, path: outPath, url: `${STOREFRONT_ORIGIN}${outPath}` };
}

/** FCM data payload (string values only). */
export function fcmDataPayload(opts: {
  path: string;
  url: string;
  campaignId?: string;
  kind?: string;
}): Record<string, string> {
  const data: Record<string, string> = {
    path: opts.path,
    link: opts.url,
  };
  if (opts.campaignId) data.campaignId = opts.campaignId;
  if (opts.kind) data.kind = opts.kind;
  return data;
}
