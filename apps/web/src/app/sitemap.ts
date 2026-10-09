import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/storefront';
import { resolveApiProxyTarget } from '@/lib/api-proxy';
import { collectCatalogSitemap, sitemapStaticEntries } from '@/lib/catalog-sitemap';

/**
 * Rendered per request, never at build time and never from the full-route cache.
 * Before: built while the API was redeploying → catch → 6 static URLs cached for up to 1 h.
 * Now a failed API call only affects that one request (and is logged); the next request retries.
 * Cost: 2–3 internal GETs per sitemap hit (crawlers fetch it rarely).
 */
export const dynamic = 'force-dynamic';

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteOrigin();
  const staticEntries = sitemapStaticEntries(base);
  const catalog = await collectCatalogSitemap({
    origin: base,
    // Server-side: same upstream as the /api/v1 proxy (API_PROXY_TARGET), not the browser URL.
    apiBase: `${resolveApiProxyTarget()}/api/v1`,
    fetchJson,
  });
  if (!catalog.complete) {
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: 'warn',
        msg: 'SITEMAP_CATALOG_DEGRADED',
        errors: catalog.errors,
        products: catalog.products.length,
        categories: catalog.categories.length,
      }),
    );
  }
  return [...staticEntries, ...catalog.categories, ...catalog.products];
}
