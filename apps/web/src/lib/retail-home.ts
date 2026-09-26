/**
 * Small-catalog retail home (1–5 sellable products).
 * Countdown, bestseller badge, nota fiscal and reviews only when the data is real.
 */

import { parseHomeShelvesPayload } from '@/lib/home-shelves';
import { INTEREST_FREE_INSTALLMENTS } from '@/lib/pricing';

export const RETAIL_HOME_MAX_PRODUCTS = 5;

export type RetailTrustItem = {
  id: string;
  title: string;
  body: string;
};

export type OfferCountdown = {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const DEFAULT_TRUST: RetailTrustItem[] = [
  {
    id: 'frete',
    title: 'Frete para todo Brasil',
    body: 'Cotação pelo CEP. Grátis em Porto Alegre.',
  },
  {
    id: 'segura',
    title: 'Compra segura',
    body: 'Pagamento processado pelo Mercado Pago.',
  },
  {
    id: 'troca',
    title: 'Troca em 7 dias',
    body: 'Direito de arrependimento, conforme os termos.',
  },
];

export function sellableCountFromCatalog(data: unknown): number | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const n = (data as { sellableTotal?: unknown }).sellableTotal;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

/** Retail layout only for a real small sellable catalog. Zero or 6+ keep the marketplace home. */
export function shouldUseRetailHome(sellableTotal: number | null | undefined): boolean {
  if (sellableTotal == null || !Number.isFinite(sellableTotal)) return false;
  return sellableTotal >= 1 && sellableTotal <= RETAIL_HOME_MAX_PRODUCTS;
}

export function isRealOffer(price: unknown, compareAt: unknown): boolean {
  const p = Number(price);
  const cmp = Number(compareAt);
  return Number.isFinite(p) && p > 0 && Number.isFinite(cmp) && cmp > p;
}

export function bestsellerIdsFromShelves(payload: unknown): Set<string> {
  const shelves = parseHomeShelvesPayload<{ id?: string }>(payload);
  const ids = new Set<string>();
  if (!shelves) return ids;
  const featured = shelves.find((shelf) => shelf.id === 'featured' && shelf.metric === 'paid_qty');
  if (!featured) return ids;
  for (const item of featured.items) {
    const id = String(item?.id || '').trim();
    if (id) ids.add(id);
  }
  return ids;
}

/** Catalog badge that claims "mais vendido" is hidden unless paid-order qty backs it. */
export function visibleCatalogBadge(badge: string | null | undefined, isBestseller: boolean): string | null {
  const text = String(badge || '').trim();
  if (!text) return null;
  if (/mais\s+vendid/i.test(text)) return isBestseller ? 'Mais vendido' : null;
  return text;
}

export function defaultPromoStripLines(): [string, string, string] {
  return ['Frete grátis em POA', '5% OFF no PIX', `Até ${INTEREST_FREE_INSTALLMENTS}x sem juros`];
}

/** Non-empty admin lines replace the default strip. Empty keeps the truthful defaults. */
export function configuredPromoLines(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const lines: string[] = [];
  for (const row of raw) {
    if (typeof row !== 'string') continue;
    const text = row.trim().replace(/\s+/g, ' ').slice(0, 48);
    if (!text) continue;
    lines.push(text);
    if (lines.length >= 4) break;
  }
  return lines.length ? lines : null;
}

export function parsePromoEnd(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** Countdown only while a configured end is still in the future. */
export function offerCountdown(endsAt: Date | null, now = Date.now()): OfferCountdown | null {
  if (!endsAt) return null;
  const totalMs = endsAt.getTime() - now;
  if (!Number.isFinite(totalMs) || totalMs <= 0) return null;
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { totalMs, days, hours, minutes, seconds };
}

function isNotaFiscal(item: { title: string; body: string }): boolean {
  return /nota\s*fiscal/i.test(`${item.title} ${item.body}`);
}

function formatCnpj(digits: string): string {
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function cnpjDigits(raw: unknown): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length === 14 ? digits : null;
}

export function resolveRetailTrust(input: { trustItems?: unknown; cnpj?: unknown }): RetailTrustItem[] {
  const cnpj = cnpjDigits(input.cnpj);
  const custom: RetailTrustItem[] = [];
  if (Array.isArray(input.trustItems)) {
    for (const row of input.trustItems) {
      if (!row || typeof row !== 'object') continue;
      const title = String((row as { title?: unknown }).title || '').trim();
      const body = String((row as { body?: unknown }).body || '').trim();
      if (title.length < 2 || body.length < 2) continue;
      if (!cnpj && isNotaFiscal({ title, body })) continue;
      custom.push({ id: `custom-${custom.length}`, title, body });
      if (custom.length >= 6) break;
    }
  }
  const items = custom.length ? custom : DEFAULT_TRUST.map((item) => ({ ...item }));
  if (cnpj && !items.some((item) => isNotaFiscal(item))) {
    items.push({
      id: 'nota-fiscal',
      title: 'Nota fiscal',
      body: `Emitida com o CNPJ ${formatCnpj(cnpj)}.`,
    });
  }
  return items.filter((item) => cnpj || !isNotaFiscal(item));
}
