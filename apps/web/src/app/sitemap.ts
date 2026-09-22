import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/storefront';
import { SITEMAP_MAX_PAGES, SITEMAP_PAGE_SIZE, sitemapProductPath, sitemapShouldFetchNext } from '@/lib/catalog-sitemap';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteOrigin();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/produtos`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/marketplace`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/suporte`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/privacidade`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/termos`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/entrar`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/cadastro`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const items: { slug: string; updatedAt?: string }[] = [];
    let page = 1;
    while (page <= SITEMAP_MAX_PAGES) {
      const res = await fetch(`${API}/products?page=${page}&pageSize=${SITEMAP_PAGE_SIZE}`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) break;
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { items?: { slug: string; updatedAt?: string }[]; total?: number };
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
    for (const p of items) {
      const path = sitemapProductPath(p.slug || '');
      if (!path) continue;
      productEntries.push({
        url: `${base}${path}`,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
        ...(p.updatedAt ? { lastModified: new Date(p.updatedAt) } : {}),
      });
    }

    const catsRes = await fetch(`${API}/categories`, { next: { revalidate: 3600 } });
    let catEntries: MetadataRoute.Sitemap = [];
    if (catsRes.ok) {
      const cj = (await catsRes.json()) as { ok?: boolean; data?: { slug: string }[] };
      catEntries = (cj.data || []).map((c) => ({
        url: `${base}/departamento/${c.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    }

    return [...staticEntries, ...catEntries, ...productEntries];
  } catch {
    return staticEntries;
  }
}
