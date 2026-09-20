/**
 * PDP trust / conversion helpers — presentation only.
 * Real catalog + existing entrega-própria quote. No fake viewers, no invented freight.
 */

import { formatDaysAfterDispatch } from '@/lib/delivery-eta';
import { catalogProductsFromResponse } from '@/lib/home-shelves';

/** Same localStorage key as the header CEP control. */
export const STOREFRONT_CEP_KEY = 'sch_cep';

export const RELATED_PRODUCTS_MAX = 8;
export const PDP_LOW_STOCK_MAX = 3;

export type PdpTrustLine = {
  id: 'troca' | 'devolucao';
  title: string;
  body: string;
  href: '/termos' | '/suporte';
};

/** Short honest lines under the price (links to existing help pages). */
export function pdpPriceTrustLines(): PdpTrustLine[] {
  return [
    {
      id: 'troca',
      title: 'Troca em 7 dias',
      body: 'Direito de arrependimento, conforme os termos da loja.',
      href: '/termos',
    },
    {
      id: 'devolucao',
      title: 'Devolução e garantia',
      body: 'Pelo suporte ou WhatsApp, com o número do pedido — sem prazo extra inventado.',
      href: '/suporte',
    },
  ];
}

/** Benefit cards below the buy CTAs — same facts, plus POA frete. */
export function pdpBenefitTrustItems(): Array<{
  id: string;
  title: string;
  body: string;
  href?: string;
}> {
  return [
    {
      id: 'frete',
      title: 'Frete POA',
      body: 'Grátis em Porto Alegre (CEP 90… e 91…), conforme a regra vigente.',
    },
    {
      id: 'troca',
      title: 'Troca 7 dias',
      body: 'Arrependimento nos termos da loja.',
      href: '/termos',
    },
    {
      id: 'suporte',
      title: 'Suporte',
      body: 'Central de atendimento da loja.',
      href: '/suporte',
    },
  ];
}

export type RelatedProductLike = {
  id?: string | null;
  slug?: string | null;
  category?: { slug?: string | null } | null;
};

export type RelatedPick<T> = {
  items: T[];
  kind: 'category' | 'catalog';
};

function relatedId(p: RelatedProductLike): string {
  return typeof p.id === 'string' ? p.id.trim() : '';
}

function relatedSlug(p: RelatedProductLike): string {
  return typeof p.slug === 'string' ? p.slug.trim() : '';
}

/** Same-category first, then other live catalog items. Hide caller-side when empty. */
export function pickRelatedProducts<T extends RelatedProductLike>(
  current: { id?: string | null; slug?: string | null; categorySlug?: string | null },
  items: T[],
  max = RELATED_PRODUCTS_MAX,
): RelatedPick<T> {
  const cap = Math.max(1, Math.min(RELATED_PRODUCTS_MAX, Math.floor(Number(max) || RELATED_PRODUCTS_MAX)));
  const curId = String(current.id || '').trim();
  const curSlug = String(current.slug || '').trim();
  const cat = String(current.categorySlug || '').trim();
  const seen = new Set<string>();
  const others: T[] = [];
  for (const item of items || []) {
    const id = relatedId(item);
    if (!id || seen.has(id)) continue;
    if (curId && id === curId) continue;
    if (curSlug && relatedSlug(item) === curSlug) continue;
    seen.add(id);
    others.push(item);
  }
  const same = cat ? others.filter((p) => String(p.category?.slug || '').trim() === cat) : [];
  const rest = cat ? others.filter((p) => String(p.category?.slug || '').trim() !== cat) : others;
  const picked = [...same, ...rest].slice(0, cap);
  return { items: picked, kind: same.length > 0 ? 'category' : 'catalog' };
}

export function shouldShowRelatedProducts(count: number): boolean {
  return Number(count) > 0;
}

export function relatedProductsCopy(kind: RelatedPick<unknown>['kind']): {
  title: string;
  subtitle: string;
} {
  if (kind === 'category') {
    return {
      title: 'Você também pode gostar',
      subtitle: 'Outros itens da mesma categoria no catálogo',
    };
  }
  return {
    title: 'Você também pode gostar',
    subtitle: 'Sugestões do catálogo Lojas Schimitz',
  };
}

export function relatedProductsHref(categorySlug?: string | null): string {
  const slug = String(categorySlug || '').trim();
  return slug ? `/departamento/${encodeURIComponent(slug)}` : '/produtos';
}

export function parseCatalogProductItems<T extends RelatedProductLike>(data: unknown): T[] {
  return catalogProductsFromResponse<T>(data);
}

export function formatCepInput(raw: string): string {
  const d = String(raw || '')
    .replace(/\D/g, '')
    .slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function cepDigits(raw: string): string {
  return String(raw || '')
    .replace(/\D/g, '')
    .slice(0, 8);
}

export function isCompleteCep(raw: string): boolean {
  return cepDigits(raw).length === 8;
}

export function readStoredCep(storage?: { getItem(key: string): string | null } | null): string {
  try {
    return formatCepInput(storage?.getItem(STOREFRONT_CEP_KEY) || '');
  } catch {
    return '';
  }
}

export function persistStoredCep(
  value: string,
  storage?: { setItem(key: string, value: string): void } | null,
): string {
  const next = formatCepInput(value);
  if (!isCompleteCep(next) || !storage) return next;
  try {
    storage.setItem(STOREFRONT_CEP_KEY, next);
  } catch {
    /* private mode */
  }
  return next;
}

export type PdpFreightQuote = {
  price: number;
  days: number;
  label?: string | null;
  modality?: string | null;
  carrier?: string | null;
  matchedPrefix?: string | null;
  freeAbove?: number | null;
};

export function pdpFreightIdleCopy(): { title: string; body: string } {
  return {
    title: 'Calcule o frete',
    body: 'Informe o CEP para ver a estimativa da entrega própria. O valor final é confirmado no checkout.',
  };
}

/** Honest fallback — never invent a carrier quote. */
export function pdpFreightCheckoutFallback(): { title: string; body: string } {
  return {
    title: 'Calcule o frete no checkout',
    body: 'Não foi possível cotar agora. A entrega própria usa o mesmo CEP no checkout.',
  };
}

function formatFreightBrl(value: number): string {
  const n = Math.round(Number(value) * 100) / 100;
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

export function pdpFreightResultCopy(q: PdpFreightQuote): { title: string; detail: string } {
  const price = Number(q.price);
  const title =
    Number.isFinite(price) && price <= 0 ? 'Frete grátis' : `Frete: ${formatFreightBrl(price)}`;
  const days = formatDaysAfterDispatch(Number(q.days) || 0);
  const bits = [q.label?.trim(), q.matchedPrefix ? `CEP ${q.matchedPrefix}…` : '']
    .filter(Boolean)
    .join(' · ');
  return { title, detail: bits ? `${days} · ${bits}` : days };
}

/** Urgency only for a real numeric stock of 1–3. No fake “N pessoas vendo”. */
export function pdpLowStockUrgency(stock: number | null | undefined): string | null {
  if (typeof stock !== 'number' || !Number.isFinite(stock)) return null;
  const n = Math.floor(stock);
  if (n <= 0 || n > PDP_LOW_STOCK_MAX) return null;
  return 'Últimas unidades';
}

export function pdpStockLine(stock: number | null | undefined): string {
  if (typeof stock !== 'number' || !Number.isFinite(stock)) return 'Estoque sob consulta';
  if (stock <= 0) return 'Esgotado';
  if (stock <= PDP_LOW_STOCK_MAX) return `Últimas unidades · ${stock} restantes`;
  return `Em estoque · ${stock} unidades`;
}
