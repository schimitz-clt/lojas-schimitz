/**
 * Storefront CSP — Phase B (2026-09-19).
 *
 * Phase A already shipped an enforcing gradual policy (Next App Router +
 * Mercado Pago Card Brick). Phase B keeps that enforce path and only applies
 * proven, non-breaking tightenings:
 *
 *  - Production enforce: drop localhost/ws from connect-src; add report-uri;
 *    add `js.mercadopago.com` (legacy SDK / security.js) and apex MP hosts
 *    observed in the official SDK v2 bundle.
 *  - Production Report-Only: same allowlist **without** `'unsafe-eval'` — probe
 *    for Phase C. Does **not** block. Do not promote to enforce until PIX +
 *    Card Brick smoke passes and reports are clean.
 *  - Dev enforce keeps localhost for `next dev` → API :3001.
 *
 * PIX: QR is `data:` (`qrcode` lib + MP `qrCodeBase64`). No MP frontend script.
 * Card Brick entry: https://sdk.mercadopago.com/js/v2
 * 3DS: MP iframes + popups (COOP `same-origin-allow-popups`). Issuer ACS
 * iframes are the residual risk — if a card 3DS challenge is blocked, rollback
 * = remove the `Content-Security-Policy` header (keep Report-Only).
 * COEP is **not** shipped (would break Brick without CORP on MP CDNs).
 *
 * Hosts observed in sdk.mercadopago.com/js/v2 (2026-09-19):
 *   script  sdk.mercadopago.com, http2.mlstatic.com, applepay.cdn-apple.com
 *   connect api.mercadopago.com, api-static.mercadopago.com, api.mercadolibre.com
 *   frame   secure-fields.mercadopago.com, sdk.mercadopago.com
 * Plus ViaCEP (checkout), next/font self-host, product `img-src https:`.
 */

export const STOREFRONT_CSP_HEADER_NAME = 'Content-Security-Policy';
export const STOREFRONT_CSP_REPORT_ONLY_HEADER_NAME = 'Content-Security-Policy-Report-Only';

/** Same-origin collector (Next proxy → Nest). */
export const CSP_REPORT_PATH = '/api/v1/security/csp-report';
export const CSP_REPORT_GROUP = 'csp-endpoint';

/** Script hosts required by Card Brick / SDK v2 (not a blanket https:). */
export const CSP_SCRIPT_HOSTS = [
  'https://sdk.mercadopago.com',
  'https://js.mercadopago.com',
  'https://http2.mlstatic.com',
  'https://*.mlstatic.com',
  'https://applepay.cdn-apple.com',
] as const;

/** XHR/fetch/WebSocket hosts (API same-origin via 'self'; MP + ViaCEP). */
export const CSP_CONNECT_HOSTS = [
  'https://api.mercadopago.com',
  'https://api-static.mercadopago.com',
  'https://*.mercadopago.com',
  'https://*.mercadopago.com.br',
  'https://www.mercadopago.com',
  'https://www.mercadopago.com.br',
  'https://mercadopago.com',
  'https://mercadopago.com.br',
  'https://js.mercadopago.com',
  'https://api.mercadolibre.com',
  'https://*.mercadolibre.com',
  'https://http2.mlstatic.com',
  'https://*.mlstatic.com',
  'https://viacep.com.br',
] as const;

/** Local-only connect (never in production enforce). */
export const CSP_DEV_CONNECT_HOSTS = [
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
  'https://js.mercadopago.com',
  'https://secure-fields.mercadopago.com',
  'https://*.mercadopago.com',
  'https://*.mercadopago.com.br',
  'https://www.mercadopago.com',
  'https://www.mercadopago.com.br',
  'https://mercadopago.com',
  'https://mercadopago.com.br',
  'https://http2.mlstatic.com',
  'https://*.mlstatic.com',
] as const;

export type CspBuildOptions = {
  /** When true, omit localhost/ws and add upgrade-insecure-requests. */
  production?: boolean;
  /** Append report-uri / report-to. Default true. */
  report?: boolean;
};

export function isStorefrontCspProduction(env: { NODE_ENV?: string } = process.env): boolean {
  return String(env.NODE_ENV || '').toLowerCase() === 'production';
}

function join(values: readonly string[]): string {
  return values.join(' ');
}

function reportDirectives(): string[] {
  return [`report-uri ${CSP_REPORT_PATH}`, `report-to ${CSP_REPORT_GROUP}`];
}

/**
 * Enforcing gradual CSP. Production drops localhost (F3) and reports
 * violations; `'unsafe-inline'`/`'unsafe-eval'` stay for Next + Brick.
 */
export function buildStorefrontCsp(opts: CspBuildOptions = {}): string {
  const production = opts.production ?? isStorefrontCspProduction();
  const report = opts.report !== false;
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
  const connectSrc = join([
    "'self'",
    ...CSP_CONNECT_HOSTS,
    ...(production ? [] : CSP_DEV_CONNECT_HOSTS),
  ]);
  const frameSrc = join(["'self'", ...CSP_FRAME_HOSTS]);
  const formAction = join([
    "'self'",
    'https://*.mercadopago.com',
    'https://*.mercadopago.com.br',
    'https://www.mercadopago.com',
    'https://www.mercadopago.com.br',
    'https://mercadopago.com',
    'https://mercadopago.com.br',
  ]);

  const parts = [
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
  ];
  if (production) parts.push('upgrade-insecure-requests');
  if (report) parts.push(...reportDirectives());
  return parts.join('; ');
}

/**
 * Report-Only probe (Phase C candidate). Never blocks.
 * Drops `'unsafe-eval'` to measure Next/Brick need before any enforce cut.
 * img-src stays `https:` here too — tightening images is a later probe.
 */
export function buildStorefrontCspReportOnly(opts: CspBuildOptions = {}): string {
  const production = opts.production ?? true;
  const scriptSrc = join([
    "'self'",
    "'unsafe-inline'",
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
    'https://www.mercadopago.com',
    'https://www.mercadopago.com.br',
    'https://mercadopago.com',
    'https://mercadopago.com.br',
  ]);

  const parts = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    "worker-src 'self' blob:",
    `form-action ${formAction}`,
    "manifest-src 'self'",
  ];
  if (production) parts.push('upgrade-insecure-requests');
  parts.push(...reportDirectives());
  return parts.join('; ');
}

export const STOREFRONT_CSP_VALUE = buildStorefrontCsp();
export const STOREFRONT_CSP_REPORT_ONLY_VALUE = buildStorefrontCspReportOnly({ production: true });
