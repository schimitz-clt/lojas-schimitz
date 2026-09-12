import { rewritePublicUploadUrl } from '@/lib/public-upload-url';

/** Tipos e fetch server-side para SEO / banners (storefront). */

export type StoreSettings = {
  id: string;
  siteTitle: string;
  siteDescription: string;
  ogImageUrl: string | null;
  updatedAt?: string;
};

export type HomeBanner = {
  id: string;
  title: string;
  alt: string;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  active: boolean;
};

/** Product fields used by generateMetadata + Product JSON-LD (real API only). */
export type ProductSeo = {
  name: string;
  description: string;
  slug: string;
  image?: string;
  images?: string[];
  sku?: string | null;
  price?: string | number;
  stock?: number | null;
  condition?: string | null;
  ratingAvg?: string | number | null;
  ratingCount?: number | null;
  category?: { slug: string; name: string } | null;
  seller?: { name: string; slug?: string } | null;
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const DEFAULT_SETTINGS: StoreSettings = {
  id: 'default',
  siteTitle: 'Lojas Schimitz',
  siteDescription:
    'Tudo o que você precisa. No padrão das grandes. Eletro, celulares e casa em Porto Alegre.',
  ogImageUrl: null,
};

/** Canonical storefront origin (www → apex for production host). */
export function siteOrigin() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').trim().replace(/\/$/, '');
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    if (u.hostname.toLowerCase() === 'www.lojasschimitz.com.br') {
      return 'https://lojasschimitz.com.br';
    }
    return `${u.protocol}//${u.host}`.replace(/\/$/, '');
  } catch {
    return raw || 'http://localhost:3000';
  }
}

export async function fetchStoreSettings(): Promise<StoreSettings> {
  try {
    const res = await fetch(`${API}/store/settings`, { next: { revalidate: 60 } });
    if (!res.ok) return DEFAULT_SETTINGS;
    const json = (await res.json()) as { ok?: boolean; data?: StoreSettings };
    if (!json.ok || !json.data) return DEFAULT_SETTINGS;
    return json.data;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function fetchProductMeta(slug: string): Promise<ProductSeo | null> {
  try {
    const res = await fetch(`${API}/products/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      ok?: boolean;
      data?: {
        name: string;
        slug?: string;
        description?: string;
        sku?: string | null;
        price?: string | number;
        stock?: number | null;
        condition?: string | null;
        ratingAvg?: string | number | null;
        ratingCount?: number | null;
        images?: { url: string }[];
        image?: string | null;
        imageUrl?: string | null;
        category?: { slug: string; name: string } | null;
        seller?: { name: string; slug?: string } | null;
      };
    };
    if (!json.ok || !json.data) return null;
    const d = json.data;
    const desc = (d.description || '').trim() || `${d.name} na Lojas Schimitz`;
    const imageUrls: string[] = [];
    for (const img of d.images || []) {
      const raw = img?.url?.trim();
      if (!raw) continue;
      imageUrls.push(rewritePublicUploadUrl(raw) || raw);
    }
    const rawImage =
      imageUrls[0] || d.image?.trim() || d.imageUrl?.trim() || undefined;
    const image = rawImage
      ? rewritePublicUploadUrl(rawImage) || rawImage
      : undefined;
    return {
      name: d.name,
      slug: d.slug || slug,
      description: desc.slice(0, 320),
      image,
      images: imageUrls.length ? imageUrls : image ? [image] : undefined,
      sku: d.sku ?? null,
      price: d.price,
      stock: d.stock ?? null,
      condition: d.condition ?? null,
      ratingAvg: d.ratingAvg ?? null,
      ratingCount: d.ratingCount ?? null,
      category: d.category
        ? { slug: d.category.slug, name: d.category.name }
        : null,
      seller: d.seller ? { name: d.seller.name, slug: d.seller.slug } : null,
    };
  } catch {
    return null;
  }
}


export async function fetchCategoryMeta(slug: string): Promise<{
  name: string;
  description: string;
} | null> {
  try {
    const res = await fetch(`${API}/categories`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      ok?: boolean;
      data?: { slug: string; name: string }[];
    };
    const items = json.data || [];
    const hit = items.find((c) => c.slug === slug);
    if (!hit) {
      // Soft fallback for nav-only slugs (e.g. ofertas) — still emit a stable title.
      const pretty = slug.replace(/-/g, ' ').trim();
      if (!pretty) return null;
      return {
        name: pretty.charAt(0).toUpperCase() + pretty.slice(1),
        description: `${pretty.charAt(0).toUpperCase() + pretty.slice(1)} na Lojas Schimitz`,
      };
    }
    return {
      name: hit.name,
      description: `${hit.name} na Lojas Schimitz — eletro, celulares e casa em Porto Alegre.`,
    };
  } catch {
    return null;
  }
}

export { DEFAULT_SETTINGS };
