/**
 * Storefront PROFESSIONAL Phase 1 — pure display helpers.
 * No network, no DOM. Pricing math stays in @/lib/pricing (5% PIX authority).
 */

import { pixPrice, pixSavings, toNumber } from '@/lib/pricing';

/** Percent off vs compare-at; null when no real discount. */
export function discountPercent(
  price: number | string,
  compareAt?: number | string | null,
): number | null {
  const p = toNumber(price);
  const cmp = toNumber(compareAt);
  if (!cmp || cmp <= p || p <= 0) return null;
  return Math.round((1 - p / cmp) * 100);
}

export type PixHighlight = {
  list: number;
  pix: number;
  savings: number;
  /** Short Portuguese tag, e.g. "5% OFF" */
  tag: string;
  /** One-line Portuguese hint for cart/PDP */
  savingsLine: string;
};

/** PIX price hierarchy for cards / PDP / cart summary (display only). */
export function pixHighlight(listPrice: number | string): PixHighlight {
  const list = toNumber(listPrice);
  const pix = pixPrice(list);
  const savings = pixSavings(list);
  return {
    list,
    pix,
    savings,
    tag: '5% OFF',
    savingsLine:
      savings > 0
        ? `Economize ${savings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} no PIX`
        : '5% de desconto no PIX',
  };
}

export type CartTrustItem = {
  title: string;
  sub: string;
};

/** Honest trust lines for cart summary (no invented seals). */
export function cartTrustItems(): CartTrustItem[] {
  return [
    { title: 'PIX 5% off', sub: 'Desconto aplicado no pagamento' },
    { title: 'Frete POA', sub: 'Grátis em Porto Alegre' },
    { title: 'Troca 7 dias', sub: 'Direito a arrependimento' },
  ];
}

export type StickyBuyState = {
  outOfStock: boolean;
  adding: boolean;
  addedToBag: boolean;
};

/** Mobile sticky CTA label — Portuguese, deterministic. */
export function stickyBuyLabel(state: StickyBuyState): string {
  if (state.outOfStock) return 'Indisponível';
  if (state.adding) return 'Adicionando...';
  if (state.addedToBag) return 'Ir para a sacola';
  return 'Adicionar à sacola';
}

/** Cart primary CTA label. */
export function cartCheckoutLabel(loggedIn: boolean): string {
  return loggedIn ? 'Finalizar compra' : 'Entrar e finalizar';
}

/* —— Phase 2: search / filters / categories (pure helpers) —— */

export type CatalogSort = 'relevance' | 'price_asc' | 'price_desc' | 'newest';

export const CATALOG_SORTS: { value: CatalogSort; label: string }[] = [
  { value: 'relevance', label: 'Relevância' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'newest', label: 'Mais recentes' },
];

export function catalogSortLabel(sort?: string | null): string {
  const s = (sort || 'relevance').trim().toLowerCase();
  const hit = CATALOG_SORTS.find((x) => x.value === s);
  return hit?.label || 'Relevância';
}

export function parseCatalogSort(sort?: string | null): CatalogSort {
  const s = (sort || 'relevance').trim().toLowerCase();
  if (s === 'price_asc' || s === 'price_desc' || s === 'newest' || s === 'relevance') return s;
  return 'relevance';
}

/** Humanize department slug when API name is missing. */
export function departmentTitle(slug: string, apiName?: string | null): string {
  const name = (apiName || '').trim();
  if (name) return name;
  const pretty = slug.replace(/-/g, ' ').trim();
  if (!pretty) return 'Departamento';
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

export type SearchResultsCopy = {
  title: string;
  subtitle: string;
};

/** Heading hierarchy for /produtos search & catalog. */
export function searchResultsHeading(
  q: string,
  total: number,
  opts?: { loading?: boolean; categoryName?: string | null },
): SearchResultsCopy {
  const query = q.trim();
  const cat = (opts?.categoryName || '').trim();
  if (opts?.loading) {
    if (query) {
      return {
        title: `Buscando “${query}”`,
        subtitle: cat ? `Em ${cat} · carregando…` : 'Carregando resultados…',
      };
    }
    return {
      title: cat || 'Produtos',
      subtitle: 'Carregando catálogo…',
    };
  }
  const countLabel =
    total === 1 ? '1 resultado' : `${total.toLocaleString('pt-BR')} resultados`;
  if (query) {
    return {
      title: `Resultados para “${query}”`,
      subtitle: cat ? `${countLabel} · em ${cat}` : countLabel,
    };
  }
  if (cat) {
    return {
      title: cat,
      subtitle: `${countLabel} no catálogo Lojas Schimitz`,
    };
  }
  return {
    title: 'Produtos',
    subtitle: `${countLabel} · catálogo Lojas Schimitz`,
  };
}

export type SearchEmptyCopy = {
  title: string;
  body: string;
  clearSearchLabel: string;
  clearFiltersLabel: string;
};

/** Empty-state copy for catalog / search (Portuguese). */
export function searchEmptyCopy(q: string, hasFilters: boolean): SearchEmptyCopy {
  const query = q.trim();
  if (query) {
    return {
      title: `Não encontramos resultados para “${query}”.`,
      body: hasFilters
        ? 'Tente outro termo, remova filtros ou explore os departamentos.'
        : 'Tente outro termo ou explore os departamentos e o marketplace.',
      clearSearchLabel: 'Só limpar busca',
      clearFiltersLabel: 'Limpar filtros',
    };
  }
  if (hasFilters) {
    return {
      title: 'Nenhum produto encontrado com esses filtros.',
      body: 'Ajuste preço ou categoria, ou limpe os filtros para ver o catálogo.',
      clearSearchLabel: 'Só limpar busca',
      clearFiltersLabel: 'Limpar filtros',
    };
  }
  return {
    title: 'Nenhum produto neste momento.',
    body: 'Volte ao início ou confira o marketplace.',
    clearSearchLabel: 'Só limpar busca',
    clearFiltersLabel: 'Limpar filtros',
  };
}

export type FilterChip = {
  id: string;
  label: string;
  /** Query key to clear (empty string = clear all except preserved) */
  clearKey: 'q' | 'category' | 'minPrice' | 'maxPrice' | 'price' | 'sort' | 'all';
};

export type FilterChipInput = {
  q?: string;
  category?: string;
  categoryName?: string | null;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
};

/** Active filter chips for catalog sticky bar (API-backed filters only). */
export function buildFilterChips(input: FilterChipInput): FilterChip[] {
  const chips: FilterChip[] = [];
  const q = (input.q || '').trim();
  if (q) chips.push({ id: 'q', label: `Busca: ${q}`, clearKey: 'q' });

  const cat = (input.category || '').trim();
  if (cat) {
    const name = (input.categoryName || '').trim() || departmentTitle(cat);
    chips.push({ id: 'category', label: name, clearKey: 'category' });
  }

  const min = (input.minPrice || '').trim();
  const max = (input.maxPrice || '').trim();
  const priceLabel = formatPriceRangeChip(min, max);
  if (priceLabel) chips.push({ id: 'price', label: priceLabel, clearKey: 'price' });

  const sort = parseCatalogSort(input.sort);
  if (sort !== 'relevance') {
    chips.push({ id: 'sort', label: catalogSortLabel(sort), clearKey: 'sort' });
  }
  return chips;
}

/** Portuguese price-range chip label; null when neither bound is set. */
export function formatPriceRangeChip(min?: string, max?: string): string | null {
  const minN = parseOptionalMoney(min);
  const maxN = parseOptionalMoney(max);
  if (minN == null && maxN == null) return null;
  const fmt = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  if (minN != null && maxN != null) return `${fmt(minN)} – ${fmt(maxN)}`;
  if (minN != null) return `A partir de ${fmt(minN)}`;
  return `Até ${fmt(maxN!)}`;
}

function parseOptionalMoney(raw?: string): number | null {
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/** Suggested department links for empty search (real routes only). */
export function emptySearchSuggestions(): { href: string; label: string }[] {
  return [
    { href: '/departamento/ofertas', label: 'Ofertas' },
    { href: '/departamento/celulares', label: 'Celulares' },
    { href: '/departamento/eletro', label: 'TVs e Áudio' },
    { href: '/departamento/eletrodomesticos', label: 'Eletrodomésticos' },
    { href: '/marketplace', label: 'Marketplace' },
  ];
}

/** Count of active catalog filters (for “Filtros (n)” mobile button). */
export function activeFilterCount(input: FilterChipInput): number {
  return buildFilterChips(input).length;
}
