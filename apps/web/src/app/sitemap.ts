import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/storefront';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteOrigin();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/produtos`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/suporte`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/entrar`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/cadastro`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const res = await fetch(`${API}/products?pageSize=60`, { next: { revalidate: 3600 } });
    if (!res.ok) return staticEntries;
    const json = (await res.json()) as {
      ok?: boolean;
      data?: { items?: { slug: string; updatedAt?: string }[] };
    };
    const items = json.data?.items || [];
    const productEntries: MetadataRoute.Sitemap = items.map((p) => ({
      url: `${base}/produto/${p.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      ...(p.updatedAt ? { lastModified: new Date(p.updatedAt) } : {}),
    }));

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
