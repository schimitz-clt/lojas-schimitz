/**
 * Identidade 2.0 — presentation only.
 * Headlines, numerals and poster type are slices of real catalog text.
 * Nothing here invents a price, a spec, a stock count or a review.
 */

import { PIX_DISCOUNT } from '@/lib/pricing';
import { parseProductStory, type ProductFeature } from '@/lib/product-story';

export type DisplayHeadline = {
  lead: string;
  /** Trailing words already present in the product name. */
  accent: string | null;
};

export type SpecNumeral = {
  label: string;
  number: string;
  unit: string;
};

export type CampaignChapter =
  | { id: 'specs'; kicker: string; specs: SpecNumeral[] }
  | { id: 'highlights'; kicker: string; items: string[] }
  | { id: 'story'; kicker: string; text: string }
  | { id: 'box'; kicker: string; items: string[] };

const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'para', 'a', 'o']);

/** Split a real product name for a serif headline. No slogan is added. */
export function displayHeadline(name: string | null | undefined): DisplayHeadline {
  const clean = String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!clean) return { lead: '', accent: null };
  const dash = clean.match(/^(.{2,42})\s+[—–-]\s+(.{2,})$/);
  if (dash) return { lead: dash[1].trim(), accent: dash[2].trim() };
  const sentence = clean.match(/^(.{2,48})\.\s+(.{2,})$/);
  if (sentence) return { lead: sentence[1].trim(), accent: sentence[2].trim() };
  const words = clean.split(' ');
  if (words.length >= 4) {
    const accentWords = words.slice(-2);
    if (accentWords.every((word) => !STOP.has(word.toLowerCase()))) {
      const lead = words.slice(0, -2).join(' ');
      const accent = accentWords.join(' ');
      if (lead.length >= 2 && accent.length >= 2) return { lead, accent };
    }
  }
  return { lead: clean, accent: null };
}

/**
 * A short token already written in the name (43", 128GB, or the first word).
 * Returns null when the name has nothing short enough to set in display type.
 */
export function posterToken(name: string | null | undefined): string | null {
  const clean = String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!clean) return null;
  const sized = clean.match(
    /\d+(?:[.,]\d+)?\s?(?:"|”|″|pol(?:egadas)?|mm|cm|gb|tb|hz|khz|w|mah)\b/i,
  );
  if (sized) {
    return sized[0]
      .replace(/\s+/g, '')
      .replace(/polegadas/i, '"')
      .replace(/pol/i, '"')
      .replace(/″/g, '"')
      .replace(/”/g, '"');
  }
  const word = clean.split(' ')[0]?.replace(/[.,;:]+$/g, '') || '';
  if (word.length >= 3 && word.length <= 14) return word;
  return null;
}

/** Big numerals only when the stored spec value itself starts with a number. */
export function specNumeral(feature: ProductFeature): SpecNumeral | null {
  const value = feature.value.trim();
  const match = value.match(
    /^([−-]?\d+(?:[.,]\d+)?(?:\s*[×xX]\s*\d+(?:[.,]\d+)?)?)\s*(.*)$/,
  );
  if (!match) return null;
  const digits = match[1].replace(/\D/g, '');
  if (!digits) return null;
  const number = match[1].replace(/\s+/g, '').replace(/-/g, '−');
  const unit = match[2].trim();
  return { label: feature.label, number, unit };
}

export function specNumerals(features: unknown, limit = 3): SpecNumeral[] {
  const story = parseProductStory({ features });
  const out: SpecNumeral[] = [];
  for (const feature of story.features) {
    const row = specNumeral(feature);
    if (!row) continue;
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

export function campaignChapters(product: {
  highlights?: unknown;
  features?: unknown;
  boxContents?: unknown;
  description?: string | null;
}): CampaignChapter[] {
  const story = parseProductStory(product);
  const chapters: CampaignChapter[] = [];
  const specs = specNumerals(product.features, 3);
  if (specs.length) chapters.push({ id: 'specs', kicker: 'Especificações', specs });
  if (story.highlights.length) {
    chapters.push({ id: 'highlights', kicker: 'O que você leva', items: story.highlights });
  }
  const text = String(product.description || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (text) chapters.push({ id: 'story', kicker: 'Sobre o produto', text });
  if (story.boxContents.length) chapters.push({ id: 'box', kicker: 'Na caixa', items: story.boxContents });
  return chapters;
}

export function campaignPath(slug: string): string {
  const clean = String(slug || '').trim();
  return `/campanha/${encodeURIComponent(clean)}`;
}

export function lineupLabel(index: number, total: number): string {
  const n = Math.max(0, Math.floor(total));
  const i = Math.min(Math.max(1, Math.floor(index)), Math.max(n, 1));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(i)} / ${pad(n)}`;
}

export function pixOffLabel(): string {
  return `No PIX · ${Math.round(PIX_DISCOUNT * 100)}% off`;
}

export function splitBrl(value: number): { whole: string; cents: string } {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const formatted = safe.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const [whole, cents] = formatted.split(',');
  return { whole: whole || '0', cents: `,${cents || '00'}` };
}
