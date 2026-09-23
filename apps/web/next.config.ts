import type { NextConfig } from 'next';
import { buildStorefrontSecurityHeaders } from './src/lib/storefront-security-headers';
import { stripPublicDevOnlyFlags } from './src/lib/strip-public-dev-flags';

/** Fail-closed: never inline simulate / null-webhook public flags in `next build`. */
const strippedPublicDevFlags = stripPublicDevOnlyFlags(process.env);
if (strippedPublicDevFlags.length > 0) {
  // eslint-disable-next-line no-console
  console.warn(
    `[security] stripped ${strippedPublicDevFlags.join(', ')} from production Next build (values not logged)`,
  );
}

/** Phase 8 baseline + Phase B CSP (enforce gradual + Report-Only probe). */
const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  images: {
    // Hero files on the live store are ~0.6–1.2MB PNGs. Serve a viewport WebP
    // and do not generate widths above the storefront column.
    formats: ['image/webp'],
    qualities: [60, 75],
    deviceSizes: [640, 828, 1080, 1280, 1920],
    imageSizes: [72, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24,
    remotePatterns: [
      { protocol: 'https', hostname: 'lojasschimitz.com.br' },
      { protocol: 'https', hostname: 'www.lojasschimitz.com.br' },
      { protocol: 'https', hostname: 'lojas-schimitz-production.up.railway.app' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildStorefrontSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
