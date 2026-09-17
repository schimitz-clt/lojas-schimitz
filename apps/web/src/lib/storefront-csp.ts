/**
 * Gradual storefront CSP (Phase A).
 *
 * Enforcing, but not nonce-strict. Next App Router hydration, JSON-LD, and
 * Mercado Pago Card Brick all need `'unsafe-inline'` (and `'unsafe-eval'` for
 * Next runtime / `next dev`). A nonce-only policy would break checkout Brick,
 * `/admin`, and Android WebView.
 *
 * Hypothesis check (2026-09-17 live GET https://lojasschimitz.com.br/):
 * Phase 8 baseline headers present (HSTS, XFO, nosniff, Referrer-Policy);
 * **no** Content-Security-Policy on HTML. API Helmet CSP is separate.
 *
 * MP SDK v2 entry: https://sdk.mercadopago.com/js/v2
 * Hosts observed in that bundle (BR Card Brick + Secure Fields):
 *   script  sdk.mercadopago.com, http2.mlstatic.com, applepay.cdn-apple.com
 *   connect api.mercadopago.com, api-static.mercadopago.com, api.mercadolibre.com
 *   frame   secure-fields.mercadopago.com, sdk.mercadopago.com/op-pay
 *   img     http2.mlstatic.com (issuer logos / brick assets)
 *
 * Plus storefront: 'self' (Next + `/api/v1` proxy), product images (`https:`),
 * next/font self-hosted Plus Jakarta Sans, ViaCEP, localhost API for `next dev`.
 *
 * Report-Only was considered; it would not reduce XSS→session residual.
 * Nonce-strict CSP remains a later phase.
 */

export const STOREFRONT_CSP_HEADER_NAME = 'Content-Security-Policy';

/** Script hosts required by Card Brick / SDK v2 (not a blanket https:). */
export const CSP_SCRIPT_HOSTS = [
  'https://sdk.mercadopago.com',
  'https://http2.mlstatic.com',
  'https://*.mlstatic.com',
  'https://applepay.cdn-apple.com',
] as const;

/** XHR/fetch/WebSocket hosts (API same-origin via 'self'; MP + ViaCEP + local). */
export const CSP_CONNECT_HOSTS = [
  'https://api.mercadopago.com',
  'https://api-static.mercadopago.com',
  'https://*.mercadopago.com',
  'https://*.mercadopago.com.br',
  'https://www.mercadopago.com.br',
  'https://mercadopago.com.br',
  'https://api.mercadolibre.com',
  'https://*.mercadolibre.com',
  'https://http2.mlstatic.com',
  'https://*.mlstatic.com',
  'https://viacep.com.br',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'ws://localhost:3000',
  'ws://127.0.0.1:3000',
] as const;

/** Secure Fields + Brick iframes (PAN/CVV never hit Schimitz). */
export const CSP_FRAME_HOSTS = [
  'https://sdk.mercadopago.com',
  'https://secure-fields.mercadopago.com',
  'https://*.mercadopago.com',
  'https://*.mercadopago.com.br',
  'https://www.mercadopago.com.br',
  'https://mercadopago.com.br',
  'https://www.mercadopago.com',
  'https://http2.mlstatic.com',
  'https://*.mlstatic.com',
] as const;

function join(values: readonly string[]): string {
  return values.join(' ');
}

/** Careful (gradual) CSP value applied by next.config headers(). */
export function buildStorefrontCsp(): string {
  const scriptSrc = join([
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "'wasm-unsafe-eval'",
    ...CSP_SCRIPT_HOSTS,
  ]);
  const styleSrc = join([
    "'self'",
    "'unsafe-inline'",
    'https://http2.mlstatic.com',
    'https://*.mlstatic.com',
  ]);
  const connectSrc = join(["'self'", ...CSP_CONNECT_HOSTS]);
  const frameSrc = join(["'self'", ...CSP_FRAME_HOSTS]);
  const formAction = join([
    "'self'",
    'https://*.mercadopago.com',
    'https://*.mercadopago.com.br',
    'https://www.mercadopago.com.br',
    'https://mercadopago.com.br',
  ]);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    // Product uploads (apex + Railway) and any https CDN; PIX QR is data:.
    "img-src 'self' data: blob: https:",
    // next/font self-hosts Plus Jakarta Sans; Brick may use data: icons.
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    "worker-src 'self' blob:",
    `form-action ${formAction}`,
    "manifest-src 'self'",
  ].join('; ');
}

export const STOREFRONT_CSP_VALUE = buildStorefrontCsp();
