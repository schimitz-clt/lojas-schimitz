import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/storefront';
import {
  SITEMAP_MAX_PAGES,
  SITEMAP_PAGE_SIZE,
  sitemapAcceptsProduct,
  sitemapCategoryPath,
  sitemapLastModified,
  sitemapProductPath,
  sitemapShouldFetchNext,
  sitemapStaticEntries,
} from '@/lib/catalog-sitemap';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

type SitemapProduct = {
  slug?: string;
  updatedAt?: string;
  isDemo?: boolean;
  active?: boolean;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteOrigin();
  const staticEntries = sitemapStaticEntries(base);

  try {
    const items: SitemapProduct[] = [];
    let page = 1;
    while (page <= SITEMAP_MAX_PAGES) {
      const res = await fetch(`${API}/products?page=${page}&pageSize=${SITEMAP_PAGE_SIZE}`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) break;
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { items?: SitemapProduct[]; total?: number };
      };
      if (!json.ok) break;
      const batch = json.data?.items || [];
      items.push(...batch);
      const total = Number(json.data?.total ?? items.length);
      if (
        !sitemapShouldFetchNext({
          page,
          pageSize: SITEMAP_PAGE_SIZE,
          received: batch.length,
          total,
          maxPages: SITEMAP_MAX_PAGES,
        })
      ) {
        break;
      }
      page += 1;
    }
    const productEntries: MetadataRoute.Sitemap = [];
    const seenProducts = new Set<string>();
    for (const p of items) {
      if (!sitemapAcceptsProduct(p)) continue;
      const path = sitemapProductPath(p.slug || '');
      if (!path || seenProducts.has(path)) continue;
      seenProducts.add(path);
      const lastModified = sitemapLastModified(p.updatedAt);
      productEntries.push({
        url: `${base}${path}`,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
        ...(lastModified ? { lastModified } : {}),
      });
    }

    const catsRes = await fetch(`${API}/categories`, { next: { revalidate: 3600 } });
    let catEntries: MetadataRoute.Sitemap = [];
    if (catsRes.ok) {
      const cj = (await catsRes.json()) as { ok?: boolean; data?: { slug?: string }[] };
      const seenCats = new Set<string>();
      catEntries = [];
      for (const c of cj.data || []) {
        const path = sitemapCategoryPath(c.slug || '');
        if (!path || seenCats.has(path)) continue;
        seenCats.add(path);
        catEntries.push({
          url: `${base}${path}`,
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        });
      }
    }

    return [...staticEntries, ...catEntries, ...productEntries];
  } catch {
    return staticEntries;
  }
}
