import type { NextConfig } from 'next';
import { STOREFRONT_SECURITY_HEADERS } from './src/lib/storefront-security-headers';

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
