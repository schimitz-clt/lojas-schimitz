import { rewritePublicUploadUrl } from '@/lib/public-upload-url';
import {
  normalizePublicSellers,
  uniqueSellersFromProducts,
  type PublicSellerCard,
} from '@/lib/marketplace-copy';
import { catalogProductsFromResponse } from '@/lib/home-shelves';
import {
  assembleRelatedProducts,
  bestsellersFromHomeShelves,
  type RelatedKind,
  type RelatedProductLike,
} from '@/lib/pdp-trust';

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

/** Full public product payload for PDP SSR (includes seller). */
export async function fetchPublicProduct(slug: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API}/products/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: Record<string, unknown> };
    if (!json.ok || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

async function fetchCatalogItems(query: { category?: string; pageSize?: number }): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams();
  params.set('page', '1');
  params.set('pageSize', String(query.pageSize ?? 24));
  if (query.category) params.set('category', query.category);
  try {
    const res = await fetch(`${API}/products?${params.toString()}`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = (await res.json()) as { ok?: boolean; data?: unknown };
    if (!json.ok) return [];
    return catalogProductsFromResponse(json.data);
  } catch {
    return [];
  }
}

export function publicProductCategorySlug(product: unknown): string | null {
  if (!product || typeof product !== 'object') return null;
  const cat = (product as { category?: { slug?: unknown } | null }).category;
  return typeof cat?.slug === 'string' && cat.slug.trim() ? cat.slug.trim() : null;
}

export function publicProductId(product: unknown): string | null {
  if (!product || typeof product !== 'object') return null;
  const id = (product as { id?: unknown }).id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

async function fetchHomeShelvesPayload(): Promise<unknown> {
  try {
    const res = await fetch(`${API}/store/shelves`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: unknown };
    if (!json.ok) return null;
    return json.data ?? null;
  } catch {
    return null;
  }
}

/** Same-department products, then Mais vendidos, then catalog — for the PDP shelf. */
export async function fetchRelatedCatalogProducts(input: {
  id?: string | null;
  slug?: string | null;
  categorySlug?: string | null;
}): Promise<{ items: RelatedProductLike[]; kind: RelatedKind }> {
  const categorySlug = String(input.categorySlug || '').trim();
  const current = { id: input.id, slug: input.slug, categorySlug };
  const categoryItems = (
    categorySlug ? await fetchCatalogItems({ category: categorySlug, pageSize: 24 }) : []
  ) as RelatedProductLike[];
  const fromCategory = assembleRelatedProducts(current, { category: categoryItems });
  if (fromCategory.kind === 'category' && fromCategory.items.length >= 2) {
    return fromCategory;
  }
  const bestsellers = bestsellersFromHomeShelves<RelatedProductLike>(await fetchHomeShelvesPayload());
  const withBest = assembleRelatedProducts(current, { category: categoryItems, bestsellers });
  if (withBest.items.length >= 2 && (withBest.kind === 'category' || withBest.kind === 'bestsellers')) {
    return withBest;
  }
  const catalog = (await fetchCatalogItems({ pageSize: 24 })) as RelatedProductLike[];
  return assembleRelatedProducts(current, { category: categoryItems, bestsellers, catalog });
}

/** Active sellers for /marketplace. Falls back to unique sellers on the catalog if GET /sellers is missing. */
export async function fetchPublicSellers(): Promise<PublicSellerCard[]> {
  try {
    const res = await fetch(`${API}/sellers`, { next: { revalidate: 60 } });
    if (res.ok) {
      const json = (await res.json()) as { ok?: boolean; data?: unknown };
      const listed = normalizePublicSellers(json.data);
      if (json.ok && listed.length) return listed;
    }
  } catch {
    /* fall through to catalog */
  }
  try {
    const res = await fetch(`${API}/products?page=1&pageSize=60`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      ok?: boolean;
      data?: { items?: Array<{ seller?: { id?: string; name?: string; slug?: string } | null }> };
    };
    if (!json.ok) return [];
    return uniqueSellersFromProducts(json.data?.items || []);
  } catch {
    return [];
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
