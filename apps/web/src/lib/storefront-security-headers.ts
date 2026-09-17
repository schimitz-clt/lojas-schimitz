import { STOREFRONT_CSP_HEADER_NAME, STOREFRONT_CSP_VALUE } from './storefront-csp';

/** Phase 8 baseline + Phase A gradual CSP (not nonce-strict — see storefront-csp.ts). */
export const STOREFRONT_SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: STOREFRONT_CSP_HEADER_NAME, value: STOREFRONT_CSP_VALUE },
];
