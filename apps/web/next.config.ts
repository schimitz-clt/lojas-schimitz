import type { NextConfig } from 'next';
import { buildStorefrontSecurityHeaders } from './src/lib/storefront-security-headers';
import { stripPublicDevOnlyFlags } from './src/lib/strip-public-dev-flags';
import { IMAGE_OPTIMIZER_REMOTE_HOSTS } from './src/lib/image-optimizer-hosts';

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
  // No `output: 'standalone'`: Railway runs `next start` (railway.toml / package.json), which
  // serves `.next/` directly. Standalone only produced an unused bundle and the deploy warning
  // '"next start" does not work with "output: standalone"'. See web-start-config.spec.ts.
  poweredByHeader: false,
  images: {
    // The optimizer only ever receives our own uploads (see src/lib/responsive-image.ts, which
    // passes relative `/api/v1/uploads/<file>` paths). It used to accept any https host (wildcard), which let
    // anyone make this server fetch and resize images from any https host (open image proxy).
    // Checked read-only against prod on 27/09/2026: every absolute image URL in the DB is on
    // lojasschimitz.com.br or placehold.co. placehold.co images are rendered as plain <img src> and
    // never go through /_next/image, so they are unaffected and stay out of this list.
    localPatterns: [{ pathname: '/api/v1/uploads/**' }],
    remotePatterns: IMAGE_OPTIMIZER_REMOTE_HOSTS.map((hostname) => ({
      protocol: 'https' as const,
      hostname,
      pathname: '/api/v1/uploads/**',
    })),
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
