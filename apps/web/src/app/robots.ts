import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/storefront';

export default function robots(): MetadataRoute.Robots {
  const base = siteOrigin();
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/conta', '/checkout', '/admin', '/pedidos'] },
    sitemap: `${base}/sitemap.xml`,
  };
}
