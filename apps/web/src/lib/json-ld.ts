/**
 * schema.org JSON-LD builders for technical SEO (Product + BreadcrumbList).
 * Pure helpers — no network. Apex URLs via siteOrigin() at call sites.
 */

export type JsonLdObject = Record<string, unknown>;

export type BreadcrumbItem = {
  name: string;
  /** Absolute or site-relative path; builders normalize to absolute with `origin`. */
  path: string;
};

export type ProductJsonLdInput = {
  name: string;
  description: string;
  slug: string;
  sku?: string | null;
  price: string | number;
  currency?: string;
  image?: string | null;
  images?: string[];
  stock?: number | null;
  condition?: string | null;
  brandName?: string | null;
  sellerName?: string | null;
  ratingAvg?: string | number | null;
  ratingCount?: number | null;
};

/** Offer availability from flat catalog stock (null = sob consulta). */
export function offerAvailability(stock: number | null | undefined): string {
  if (stock === null || stock === undefined) {
    return 'https://schema.org/LimitedAvailability';
  }
  if (stock <= 0) return 'https://schema.org/OutOfStock';
  return 'https://schema.org/InStock';
}

export function itemCondition(condition: string | null | undefined): string {
  const c = String(condition || 'new').toLowerCase();
  if (c === 'used' || c === 'refurbished') {
    return 'https://schema.org/UsedCondition';
  }
  return 'https://schema.org/NewCondition';
}

/** Normalize BRL price for schema.org Offer.price (string decimal). */
export function formatOfferPrice(price: string | number): string {
  const n = typeof price === 'number' ? price : Number(String(price).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return '0';
  return n.toFixed(2);
}

function absUrl(origin: string, path: string): string {
  const base = origin.replace(/\/$/, '');
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export function buildBreadcrumbList(origin: string, items: BreadcrumbItem[]): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absUrl(origin, item.path),
    })),
  };
}

export function buildProductJsonLd(origin: string, p: ProductJsonLdInput): JsonLdObject {
  const path = `/produto/${encodeURIComponent(p.slug)}`;
  const url = absUrl(origin, path);
  const images: string[] = [];
  if (p.images?.length) {
    for (const u of p.images) {
      if (u?.trim()) images.push(u.trim());
    }
  } else if (p.image?.trim()) {
    images.push(p.image.trim());
  }

  const brandName = (p.brandName || p.sellerName || 'Lojas Schimitz').trim();
  const sellerName = (p.sellerName || 'Lojas Schimitz').trim();

  const offer: JsonLdObject = {
    '@type': 'Offer',
    url,
    priceCurrency: p.currency || 'BRL',
    price: formatOfferPrice(p.price),
    availability: offerAvailability(p.stock),
    itemCondition: itemCondition(p.condition),
    seller: {
      '@type': 'Organization',
      name: sellerName,
    },
  };

  const out: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    url,
    ...(p.sku ? { sku: String(p.sku) } : {}),
    ...(images.length ? { image: images.length === 1 ? images[0] : images } : {}),
    brand: {
      '@type': 'Brand',
      name: brandName,
    },
    offers: offer,
  };

  const count = Number(p.ratingCount || 0);
  const avg = Number(p.ratingAvg || 0);
  if (count > 0 && Number.isFinite(avg) && avg > 0) {
    out.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(avg.toFixed(2)),
      reviewCount: count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return out;
}

/** Serialize for <script type="application/ld+json"> (safe vs </script>). */
export function stringifyJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
