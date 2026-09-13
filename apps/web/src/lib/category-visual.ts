import { isMissingOrPlaceholderImage } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';

/** Minimal product-like shape for category pickers (storefront only). */
export type CatProductLike = {
  name: string;
  slug?: string;
  images?: { url: string }[];
  image?: string | null;
  imageUrl?: string | null;
  category?: { slug: string; name: string } | null;
  badge?: string | null;
  compareAtPrice?: number | string | null;
};

export type HomeCategory = {
  href: string;
  label: string;
  /** Department slug used for matching live products */
  slug: string;
  /** Extra name keywords for soft matching when category relation is missing */
  keywords: string[];
  /** Local professional silhouette fallback (not emoji / not clipart) */
  fallback: string;
};

export const HOME_CATEGORIES: HomeCategory[] = [
  {
    href: '/departamento/ofertas',
    label: 'Ofertas',
    slug: 'ofertas',
    keywords: ['oferta'],
    fallback: '/cats/ofertas.svg',
  },
  {
    href: '/departamento/celulares',
    label: 'Celulares',
    slug: 'celulares',
    keywords: ['celular', 'smartphone', 'iphone', 'samsung', 'motorola'],
    fallback: '/cats/celulares.svg',
  },
  {
    href: '/departamento/informatica',
    label: 'Informática',
    slug: 'informatica',
    keywords: ['notebook', 'laptop', 'informática', 'informatica', 'pc', 'mouse', 'teclado'],
    fallback: '/cats/informatica.svg',
  },
  {
    href: '/departamento/eletro',
    label: 'Eletro',
    slug: 'eletro',
    keywords: ['tv', 'televisão', 'televisao', 'soundbar', 'eletro'],
    fallback: '/cats/eletro.svg',
  },
  {
    href: '/departamento/eletrodomesticos',
    label: 'Eletrodomésticos',
    slug: 'eletrodomesticos',
    keywords: [
      'eletrodomést',
      'eletrodomest',
      'geladeira',
      'fogão',
      'fogao',
      'máquina',
      'maquina',
      'ar-condicionado',
      'ar condicionado',
      'aiwa',
      'lavadora',
      'micro-ondas',
      'microondas',
    ],
    fallback: '/cats/eletrodomesticos.svg',
  },
  {
    href: '/departamento/casa',
    label: 'Casa',
    slug: 'casa',
    keywords: ['casa', 'cozinha', 'cama', 'mesa'],
    fallback: '/cats/casa.svg',
  },
  {
    href: '/departamento/esporte',
    label: 'Esporte',
    slug: 'esporte',
    keywords: ['esporte', 'bike', 'bicicleta', 'fitness'],
    fallback: '/cats/esporte.svg',
  },
  {
    href: '/marketplace',
    label: 'Marketplace',
    slug: 'marketplace',
    keywords: [],
    fallback: '/cats/marketplace.svg',
  },
];

export function resolveRealProductImageUrl(p: CatProductLike): string {
  const nested = p.images?.[0]?.url?.trim() || '';
  const flat = (p.image || p.imageUrl || '').trim();
  const raw = nested || flat;
  const rewritten = rewritePublicUploadUrl(raw) || raw;
  if (isMissingOrPlaceholderImage(rewritten)) return '';
  return rewritten;
}

function matchesCategory(p: CatProductLike, cat: HomeCategory): boolean {
  const catSlug = (p.category?.slug || '').toLowerCase();
  if (catSlug && (catSlug === cat.slug || catSlug.includes(cat.slug))) return true;
  if (cat.slug === 'ofertas') {
    return Boolean(p.compareAtPrice || p.badge);
  }
  const hay = `${p.name} ${p.slug || ''} ${p.category?.name || ''}`.toLowerCase();
  return cat.keywords.some((k) => hay.includes(k.toLowerCase()));
}

/**
 * Prefer a real Lojas Schimitz product photo for the category circle;
 * otherwise the clean local silhouette fallback.
 */
export function categoryCircleSrc(products: CatProductLike[], cat: HomeCategory): string {
  for (const p of products) {
    if (!matchesCategory(p, cat)) continue;
    const img = resolveRealProductImageUrl(p);
    if (img) return img;
  }
  // Soft fallback: any real catalog photo for ofertas / marketplace
  if (cat.slug === 'ofertas' || cat.slug === 'marketplace') {
    for (const p of products) {
      const img = resolveRealProductImageUrl(p);
      if (img) return img;
    }
  }
  return cat.fallback;
}

/** Best live product with a real photo for hero composition (no invented data). */
export function pickFeaturedHeroProduct<T extends CatProductLike & { price?: number | string }>(
  products: T[],
): T | null {
  const withPhoto = products.filter((p) => resolveRealProductImageUrl(p));
  if (!withPhoto.length) return null;
  const offers = withPhoto.filter((p) => p.compareAtPrice || p.badge);
  return (offers[0] || withPhoto[0]) ?? null;
}
