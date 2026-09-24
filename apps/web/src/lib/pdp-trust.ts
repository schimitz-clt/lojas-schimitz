/**
 * PDP trust / conversion helpers — presentation only.
 * Real catalog + existing entrega-própria quote. No fake viewers, no invented freight.
 */

import { formatDaysAfterDispatch } from '@/lib/delivery-eta';
import { catalogProductsFromResponse, parseHomeShelvesPayload } from '@/lib/home-shelves';
import { LOW_STOCK_LABEL, LOW_STOCK_MAX, shouldShowLowStock } from '@/lib/low-stock';

/** Same localStorage key as the header CEP control. */
export const STOREFRONT_CEP_KEY = 'sch_cep';

export const RELATED_PRODUCTS_MAX = 8;
export const PDP_LOW_STOCK_MAX = LOW_STOCK_MAX;

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

export type RelatedKind = 'category' | 'bestsellers' | 'catalog';

export type RelatedPick<T> = {
  items: T[];
  kind: RelatedKind;
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

export function relatedProductsCopy(kind: RelatedKind): {
  title: string;
  subtitle: string;
} {
  const title = 'Quem viu também viu';
  if (kind === 'category') {
    return {
      title,
      subtitle: 'Outros itens da mesma categoria no catálogo',
    };
  }
  if (kind === 'bestsellers') {
    return {
      title,
      subtitle: 'Mais vendidos da loja',
    };
  }
  return {
    title,
    subtitle: 'Sugestões do catálogo Lojas Schimitz',
  };
}

export function relatedProductsHref(categorySlug?: string | null, kind?: RelatedKind): string {
  if (kind === 'bestsellers') return '/produtos?sort=relevance';
  const slug = String(categorySlug || '').trim();
  return slug ? `/departamento/${encodeURIComponent(slug)}` : '/produtos';
}

/** “Ver mais” target for the related shelf — department, mais vendidos, or catalog. */
export function relatedShelfLink(
  kind: RelatedKind,
  categorySlug?: string | null,
  categoryName?: string | null,
): { href: string; label: string } {
  if (kind === 'bestsellers') {
    return { href: relatedProductsHref(null, 'bestsellers'), label: 'Ver mais vendidos' };
  }
  const name = String(categoryName || '').trim();
  return {
    href: relatedProductsHref(categorySlug, kind),
    label: name && kind === 'category' ? `Ver ${name}` : 'Ver catálogo',
  };
}

/**
 * Same department first. Pad with the home “Mais vendidos” shelf only when that
 * shelf is a real sales/rating ranking — never the “Em destaque” newest fallback.
 * Generic catalog is the last fill. No mocks.
 */
export function assembleRelatedProducts<T extends RelatedProductLike>(
  current: { id?: string | null; slug?: string | null; categorySlug?: string | null },
  sources: { category?: T[] | null; bestsellers?: T[] | null; catalog?: T[] | null },
  max = RELATED_PRODUCTS_MAX,
): RelatedPick<T> {
  const category = sources.category || [];
  const bestsellers = sources.bestsellers || [];
  const catalog = sources.catalog || [];
  const fromCategory = pickRelatedProducts(current, category, max);
  if (fromCategory.kind === 'category' && fromCategory.items.length >= 2) {
    return { items: fromCategory.items, kind: 'category' };
  }

  // One department neighbor is still a category shelf; pad the rail when a fallback exists.
  if (fromCategory.kind === 'category' && fromCategory.items.length > 0) {
    const padded = pickRelatedProducts(current, [...category, ...bestsellers, ...catalog], max);
    return { items: padded.items, kind: 'category' };
  }

  const withBest = bestsellers.length
    ? pickRelatedProducts(current, [...category, ...bestsellers], max)
    : fromCategory;
  const bestGrew = withBest.items.length > fromCategory.items.length;
  if (bestGrew && withBest.items.length >= 2) {
    return { items: withBest.items, kind: 'bestsellers' };
  }

  const filled = pickRelatedProducts(current, [...category, ...bestsellers, ...catalog], max);
  if (bestGrew) return { items: filled.items, kind: 'bestsellers' };
  return { items: filled.items, kind: 'catalog' };
}

/** Featured home shelf items only when the API calls them Mais vendidos (paid qty or ratings). */
export function bestsellersFromHomeShelves<T extends RelatedProductLike>(payload: unknown): T[] {
  const shelves = parseHomeShelvesPayload(payload);
  if (!shelves) return [];
  const featured = shelves.find((shelf) => shelf.id === 'featured');
  if (!featured) return [];
  if (featured.metric !== 'paid_qty' && featured.metric !== 'rating_count') return [];
  return featured.items as T[];
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
    title: 'Frete e prazo',
    body: 'Informe o CEP para ver a estimativa da entrega própria. O valor final é confirmado no checkout.',
  };
}

export type PdpTrustChip = {
  id: 'seller' | 'troca' | 'garantia';
  label: string;
  href?: PdpTrustLine['href'];
};

/** Short buy-box chips. Facts stay the existing troca/suporte lines — no new promises. */
export function pdpCompactTrustChips(
  sellerName?: string | null,
  lines: PdpTrustLine[] = pdpPriceTrustLines(),
): PdpTrustChip[] {
  const troca = lines.find((line) => line.id === 'troca');
  const garantia = lines.find((line) => line.id === 'devolucao');
  const seller = String(sellerName || '').trim();
  return [
    {
      id: 'seller',
      label: seller ? `Vendido por ${seller}` : 'Lojas Schimitz',
    },
    {
      id: 'troca',
      label: 'Troca em 7 dias',
      href: troca?.href ?? '/termos',
    },
    {
      id: 'garantia',
      label: 'Garantia e qualidade',
      href: garantia?.href ?? '/suporte',
    },
  ];
}

/** Honest fallback — never invent a carrier quote. */
export function pdpFreightCheckoutFallback(): { title: string; body: string } {
  return {
    title: 'Calcule o frete no checkout',
    body: 'Não foi possível cotar agora. A entrega própria usa o mesmo CEP no checkout.',
  };
}

/**
 * Mensagem de erro da cotação na PDP.
 * Prefere a mensagem estruturada da API (ex.: CEP inválido); senão o fallback genérico.
 */
export function pdpFreightErrorCopy(apiMessage?: string | null): { title: string; body: string } {
  const msg = String(apiMessage || '').trim();
  const fallback = pdpFreightCheckoutFallback();
  if (!msg) return fallback;
  const lower = msg.toLowerCase();
  if (/cep inválido|cep invalido|não encontrado|nao encontrado/.test(lower)) {
    return { title: 'CEP inválido', body: msg };
  }
  return { title: 'Não foi possível calcular o frete', body: msg };
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

/** City/zone from the quote label. Skips freight sentences so we never invent a street. */
export function pdpFreightPlaceName(label?: string | null): string {
  const raw = String(label || '').trim();
  if (!raw) return '';
  const head = raw.split(/[—–]/)[0].trim();
  if (!head || /frete|entrega|gr[aá]tis|r\$/i.test(head)) return '';
  return head;
}

/** Destination we actually know: saved CEP, plus the quote place when it is a real zone. */
export function pdpFreightDestinationLine(cep: string, label?: string | null): string {
  const formatted = formatCepInput(cep);
  if (!formatted) return 'Informe o CEP de entrega';
  const place = pdpFreightPlaceName(label);
  return place ? `Enviar para ${place} · ${formatted}` : `Enviar para ${formatted}`;
}

/**
 * Receive row. Prazo stays “N dias após o despacho” — no calendar date we do not have.
 * Cost is Grátis or the quoted BRL amount.
 */
export function pdpFreightEstimateRow(q: PdpFreightQuote): { eta: string; price: string; note: string } {
  const amount = Number(q.price);
  const price =
    Number.isFinite(amount) && amount <= 0 ? 'Grátis' : formatFreightBrl(amount);
  return {
    eta: formatDaysAfterDispatch(Number(q.days) || 0),
    price,
    note: 'Após o despacho. O valor final é confirmado no checkout.',
  };
}

/** Urgency only for a real numeric stock of 1–3. No fake “N pessoas vendo”. */
export function pdpLowStockUrgency(stock: number | null | undefined): string | null {
  return shouldShowLowStock(stock) ? LOW_STOCK_LABEL : null;
}

export function pdpStockLine(stock: number | null | undefined): string {
  if (typeof stock !== 'number' || !Number.isFinite(stock)) return 'Estoque sob consulta';
  if (stock <= 0) return 'Esgotado';
  if (shouldShowLowStock(stock)) return `${LOW_STOCK_LABEL} · ${stock} restantes`;
  return `Em estoque · ${stock} unidades`;
}