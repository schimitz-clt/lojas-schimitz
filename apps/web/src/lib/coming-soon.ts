/**
 * Home "Em breve" teaser — marketing only.
 * These are not SKUs: no price, no stock, no PDP, no cart.
 * Hide as soon as GET /products reports at least one active product.
 * Active includes demonstrative SKUs (isDemo). They are a navigation catalog.
 * Sellable stock is active && !isDemo and is not what this shelf counts.
 */

export const COMING_SOON_HIDE_WHEN_ACTIVE_AT_LEAST = 1;

export type ComingSoonCategory = 'TVs e Áudio' | 'Celulares' | 'Informática' | 'Eletrodomésticos';

export type ComingSoonProduct = {
  id: string;
  /** Exact Lote 1 display name. */
  name: string;
  category: ComingSoonCategory;
  /** Existing storefront category silhouette — not a product photo. */
  icon: string;
};

export const COMING_SOON_PRODUCTS: readonly ComingSoonProduct[] = [
  {
    id: 'smart-tv-55',
    name: 'Smart TV 55" 4K',
    category: 'TVs e Áudio',
    icon: '/cats/eletro.svg',
  },
  {
    id: 'smartphone-128',
    name: 'Smartphone 128GB',
    category: 'Celulares',
    icon: '/cats/celulares.svg',
  },
  {
    id: 'notebook-i5',
    name: 'Notebook i5 16GB 512SSD',
    category: 'Informática',
    icon: '/cats/informatica.svg',
  },
  {
    id: 'ar-aiwa',
    name: 'Ar-condicionado Aiwa',
    category: 'Eletrodomésticos',
    icon: '/cats/eletrodomesticos.svg',
  },
  {
    id: 'geladeira-400',
    name: 'Geladeira Frost Free 400L',
    category: 'Eletrodomésticos',
    icon: '/cats/eletrodomesticos.svg',
  },
];

export function comingSoonTitle(): string {
  return 'Em breve';
}

export function comingSoonSubtitle(): string {
  return 'Chegando na loja. Avise-me no WhatsApp e fique de olho.';
}

export function comingSoonCtaLabel(): string {
  return 'Avise-me';
}

export function comingSoonBadgeLabel(): string {
  return 'Em breve';
}

export function comingSoonCardNote(): string {
  return 'Sem preço e sem estoque ainda';
}

export function comingSoonWhatsAppText(): string {
  return 'Olá! Vi a vitrine Em breve da Lojas Schimitz e quero ser avisado quando esses produtos chegarem.';
}

/** Visible shelf note: names are a preview, not a catalog. */
export function comingSoonDisclaimer(): string {
  return 'Prévia. Estes nomes não estão à venda: sem preço, sem estoque e sem sacola.';
}

/** Show the teaser only while the live catalog has zero active products. */
export function shouldShowComingSoonShelf(activeProductCount: number): boolean {
  if (!Number.isFinite(activeProductCount)) return false;
  return activeProductCount < COMING_SOON_HIDE_WHEN_ACTIVE_AT_LEAST;
}

/**
 * Active count from GET /products (`data.total`, else `items.length`, else a bare array).
 * Uses the larger of total and items so a non-empty page still hides the teaser.
 */
export function activeProductCountFromCatalog(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (!data || typeof data !== 'object') return 0;
  const row = data as { total?: unknown; items?: unknown };
  const items = Array.isArray(row.items) ? row.items.length : 0;
  const total = typeof row.total === 'number' && Number.isFinite(row.total) ? row.total : null;
  if (total == null) return items;
  return Math.max(0, total, items);
}
