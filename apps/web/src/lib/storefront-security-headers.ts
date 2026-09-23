import {
  CSP_REPORT_GROUP,
  CSP_REPORT_PATH,
  STOREFRONT_CSP_HEADER_NAME,
  STOREFRONT_CSP_REPORT_ONLY_HEADER_NAME,
  buildStorefrontCsp,
  buildStorefrontCspReportOnly,
  isStorefrontCspProduction,
} from './storefront-csp';

/**
 * Permissions-Policy: deny powerful device APIs the storefront does not use.
 * `payment` and `fullscreen` are left unset (MP wallets / future lightbox).
 * Clipboard is left unset — PIX copia-e-cola uses `navigator.clipboard`.
 * `bluetooth` and `document-domain` are omitted: Chrome logs them as
 * unrecognized Permissions-Policy features (document-domain belongs on
 * Document-Policy). They were no-ops and showed up on every storefront page.
 * COOP `same-origin-allow-popups` isolates the browsing context without blocking
 * 3DS/wallet popups. CORP `same-origin` on HTML/assets; MP Brick loads from MP CDNs
 * (not our origin). COEP is **not** set — it would break Card Brick without CORP on MP.
 */
export const STOREFRONT_PERMISSIONS_POLICY = [
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'interest-cohort=()',
  'browsing-topics=()',
  'usb=()',
  'midi=()',
  'magnetometer=()',
  'accelerometer=()',
  'gyroscope=()',
  'display-capture=()',
  'serial=()',
  'hid=()',
  'xr-spatial-tracking=()',
].join(', ');

export const STOREFRONT_HSTS = 'max-age=31536000; includeSubDomains; preload';

export const STOREFRONT_REPORTING_ENDPOINTS = `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`;

export type SecurityHeader = { key: string; value: string };

export type StorefrontHeaderOptions = {
  production?: boolean;
};

/**
 * Phase 8 baseline + Phase B CSP (enforce gradual + Report-Only probe).
 * Production adds HSTS preload, Reporting-Endpoints, and the report-only header.
 */
export function buildStorefrontSecurityHeaders(
  opts: StorefrontHeaderOptions = {},
): SecurityHeader[] {
  const production = opts.production ?? isStorefrontCspProduction();
  const headers: SecurityHeader[] = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: STOREFRONT_PERMISSIONS_POLICY },
    { key: 'Strict-Transport-Security', value: STOREFRONT_HSTS },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    { key: STOREFRONT_CSP_HEADER_NAME, value: buildStorefrontCsp({ production }) },
  ];
  if (production) {
    headers.push({ key: 'Reporting-Endpoints', value: STOREFRONT_REPORTING_ENDPOINTS });
    headers.push({
      key: STOREFRONT_CSP_REPORT_ONLY_HEADER_NAME,
      value: buildStorefrontCspReportOnly({ production: true }),
    });
  }
  return headers;
}

/** Default for next.config — evaluated at build/start (NODE_ENV=production in deploy). */
export const STOREFRONT_SECURITY_HEADERS = buildStorefrontSecurityHeaders();
