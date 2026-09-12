/**
 * Apex www mitigation (Next.js middleware).
 *
 * If the request Host is www.lojasschimitz.com.br, 301 to
 * https://lojasschimitz.com.br + same path + query.
 *
 * This only runs when the request actually reaches Next.js.
 * Today www 404s at the Railway edge (`Application not found`) before
 * the app — Railway must attach the www custom domain and/or Cloudflare
 * must 301 www → apex. See docs/MEGA-PHASE-1-2-CHECKPOINT.md.
 */

export const WWW_HOST = 'www.lojasschimitz.com.br';
export const APEX_ORIGIN = 'https://lojasschimitz.com.br';

export function normalizeHost(host: string | null | undefined): string {
  return String(host || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
    .split(':')[0];
}

/** Absolute Location for a 301, or null if no redirect. */
export function wwwApexRedirectUrl(input: {
  host?: string | null;
  pathname?: string;
  search?: string;
}): string | null {
  if (normalizeHost(input.host) !== WWW_HOST) return null;
  const path = input.pathname && input.pathname.startsWith('/') ? input.pathname : '/';
  const search = input.search
    ? input.search.startsWith('?')
      ? input.search
      : `?${input.search}`
    : '';
  return `${APEX_ORIGIN}${path}${search}`;
}
