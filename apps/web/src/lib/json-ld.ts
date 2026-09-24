/**
 * schema.org JSON-LD builders for technical SEO (Organization, WebSite, Product, BreadcrumbList).
 * Pure helpers — no network. Apex URLs via siteOrigin() at call sites.
 */

import { isMissingOrPlaceholderImage } from './placeholder-image';

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

/** Catalog photo for schema.org, or null when it is empty, a placeholder, or the site root. */
export function schemaImageUrl(origin: string, raw: string | null | undefined): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value || isMissingOrPlaceholderImage(value)) return null;
  const abs = absUrl(origin, value);
  try {
    const url = new URL(abs);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.pathname === '/' || url.pathname === '') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function schemaTelephone(digits: string | null | undefined): string | null {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length < 12 || d.length > 15) return null;
  return `+${d}`;
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
  const rawImages = p.images?.length ? p.images : p.image ? [p.image] : [];
  for (const u of rawImages) {
    const abs = schemaImageUrl(origin, u);
    if (abs && !images.includes(abs)) images.push(abs);
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

export type StoreJsonLdInput = {
  name: string;
  description: string;
  /** Absolute or site-relative logo (square icon, not a product photo). */
  logoUrl: string;
  /** Digits with country code, e.g. 5551996253766. Omitted when it does not look like a phone. */
  telephone?: string | null;
};

/** Organization + WebSite (with catalog search) for the storefront root. */
export function buildStoreJsonLd(origin: string, input: StoreJsonLdInput): JsonLdObject[] {
  const base = origin.replace(/\/$/, '');
  const name = (input.name || 'Lojas Schimitz').trim() || 'Lojas Schimitz';
  const description = (input.description || '').trim();
  const logo = schemaImageUrl(origin, input.logoUrl);
  const telephone = schemaTelephone(input.telephone);

  const organization: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url: base,
    ...(description ? { description } : {}),
    ...(logo ? { logo } : {}),
    ...(telephone
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            telephone,
            contactType: 'customer service',
            areaServed: 'BR',
            availableLanguage: ['Portuguese'],
          },
        }
      : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Porto Alegre',
      addressCountry: 'BR',
    },
  };

  const website: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url: base,
    inLanguage: 'pt-BR',
    ...(description ? { description } : {}),
    publisher: {
      '@type': 'Organization',
      name,
      url: base,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${base}/produtos?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return [organization, website];
}

/** Serialize for <script type="application/ld+json"> (safe vs </script>). */
export function stringifyJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
