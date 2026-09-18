import { STOREFRONT_CSP_HEADER_NAME, STOREFRONT_CSP_VALUE } from './storefront-csp';

/**
 * Permissions-Policy: deny powerful device APIs the storefront does not use.
 * `payment` and `fullscreen` are left unset (MP wallets / future lightbox).
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
  'bluetooth=()',
  'midi=()',
  'magnetometer=()',
  'accelerometer=()',
  'gyroscope=()',
  'display-capture=()',
  'document-domain=()',
  'serial=()',
  'hid=()',
  'xr-spatial-tracking=()',
].join(', ');

/** Phase 8 baseline + Phase A gradual CSP (not nonce-strict — see storefront-csp.ts). */
export const STOREFRONT_SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: STOREFRONT_PERMISSIONS_POLICY },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: STOREFRONT_CSP_HEADER_NAME, value: STOREFRONT_CSP_VALUE },
];
