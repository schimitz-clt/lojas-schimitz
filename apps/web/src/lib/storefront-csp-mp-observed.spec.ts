import assert from 'node:assert/strict';
import { buildStorefrontCsp, buildStorefrontCspReportOnly } from './storefront-csp';

/**
 * Hosts the Mercado Pago Card Payment Brick (SDK v2, incl. device fingerprint/antifraude)
 * actually requested from https://lojasschimitz.com.br in the 09/10/2026 probe
 * (scripts/csp-probe-mp.mjs, docs/SECURITY-CSP-2026-10-09.md). The policy must keep allowing
 * every one of them under the matching directive, in enforce AND in the Report-Only probe.
 */
const OBSERVED: { directive: 'script-src' | 'connect-src' | 'frame-src' | 'img-src'; url: string }[] = [
  { directive: 'script-src', url: 'https://sdk.mercadopago.com/js/v2' },
  { directive: 'script-src', url: 'https://http2.mlstatic.com/storage/event-metrics-sdk/js' },
  { directive: 'connect-src', url: 'https://api.mercadopago.com/v1/payment_methods/search' },
  { directive: 'connect-src', url: 'https://api.mercadolibre.com/tracks' },
  { directive: 'connect-src', url: 'https://www.mercadolibre.com/jms/lgz/background/etid' },
  { directive: 'connect-src', url: 'https://www.mercadolibre.com/jms/lgz/fingerprint/high/armor.x' },
  { directive: 'connect-src', url: 'https://http2.mlstatic.com/frontend-assets/x.json' },
  { directive: 'connect-src', url: 'https://secure-fields.mercadopago.com/x' },
  { directive: 'frame-src', url: 'https://secure-fields.mercadopago.com/' },
  { directive: 'img-src', url: 'https://www.mercadolibre.com/jms/lgz/fingerprint/pixel/armor.x' },
  { directive: 'img-src', url: 'https://www.mercadopago.com.br/jms/lgz/fingerprint/medium/armor.x' },
  { directive: 'img-src', url: 'https://www.mercadolivre.com/jms/mlb/lgz/background/session/armor.x' },
];

function sources(csp: string, directive: string): string[] {
  const part = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${directive} `));
  if (part) return part.split(/\s+/).slice(1);
  const fallback = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('default-src '));
  return fallback ? fallback.split(/\s+/).slice(1) : [];
}

/** Minimal CSP host-source matcher (scheme, exact host or *.wildcard, optional path prefix). */
export function cspAllows(csp: string, directive: string, rawUrl: string): boolean {
  const url = new URL(rawUrl);
  for (const src of sources(csp, directive)) {
    if (src === 'https:' && url.protocol === 'https:') return true;
    if (src.startsWith("'")) continue;
    const m = /^(https?):\/\/([^/]+)(\/.*)?$/.exec(src);
    if (!m) continue;
    if (`${m[1]}:` !== url.protocol) continue;
    const host = m[2];
    const ok = host.startsWith('*.')
      ? url.hostname.endsWith(host.slice(1)) && url.hostname !== host.slice(2)
      : url.hostname === host;
    if (!ok) continue;
    if (m[3] && !url.pathname.startsWith(m[3])) continue;
    return true;
  }
  return false;
}

// Matcher sanity.
assert.equal(cspAllows("connect-src 'self' https://*.mercadolibre.com", 'connect-src', 'https://www.mercadolibre.com/x'), true);
assert.equal(cspAllows("connect-src 'self' https://*.mercadolibre.com", 'connect-src', 'https://mercadolibre.com/x'), false);
assert.equal(cspAllows("connect-src 'self' https://*.mercadolibre.com", 'connect-src', 'https://www.mercadolivre.com/x'), false);
assert.equal(cspAllows("default-src 'self'; img-src https:", 'img-src', 'https://a.b/c'), true);
assert.equal(cspAllows("default-src 'self'", 'frame-src', 'https://a.b/c'), false);

const policies = {
  enforce: buildStorefrontCsp({ production: true }),
  reportOnly: buildStorefrontCspReportOnly({ production: true }),
};
for (const [name, csp] of Object.entries(policies)) {
  for (const o of OBSERVED) {
    assert.ok(cspAllows(csp, o.directive, o.url), `${name}: ${o.directive} deve permitir ${o.url}`);
  }
}

console.log('storefront-csp-mp-observed.spec OK');
