import type { NextConfig } from 'next';
import { STOREFRONT_SECURITY_HEADERS } from './src/lib/storefront-security-headers';
import { stripPublicDevOnlyFlags } from './src/lib/strip-public-dev-flags';

/** Fail-closed: never inline simulate / null-webhook public flags in `next build`. */
const strippedPublicDevFlags = stripPublicDevOnlyFlags(process.env);
if (strippedPublicDevFlags.length > 0) {
  // eslint-disable-next-line no-console
  console.warn(
    `[security] stripped ${strippedPublicDevFlags.join(', ')} from production Next build (values not logged)`,
  );
}

/** Phase 8 baseline headers + Phase A gradual CSP (see storefront-csp.ts). */
const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: STOREFRONT_SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
