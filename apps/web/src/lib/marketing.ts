/**
 * Paid-media hooks. IDs come only from env. Unset or malformed values are no-ops.
 * UTM is stored for the checkout request and never invented.
 */

export const UTM_STORAGE_KEY = 'sch_utm';

export type StoredUtm = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
};

const UTM_QUERY: Record<keyof StoredUtm, string> = {
  utmSource: 'utm_source',
  utmMedium: 'utm_medium',
  utmCampaign: 'utm_campaign',
  utmContent: 'utm_content',
  utmTerm: 'utm_term',
};

const UTM_MAX: Record<keyof StoredUtm, number> = {
  utmSource: 80,
  utmMedium: 80,
  utmCampaign: 120,
  utmContent: 120,
  utmTerm: 120,
};

export function sanitizeUtmValue(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .trim()
    .replace(/[^\p{L}\p{N} ._~+\-|]/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, max)
    .trim();
  return cleaned.length ? cleaned : null;
}

export function utmFromSearch(search: string | URLSearchParams | null | undefined): StoredUtm {
  const params = typeof search === 'string' ? new URLSearchParams(search.startsWith('?') ? search : `?${search}`) : search;
  const out: StoredUtm = {};
  if (!params) return out;
  (Object.keys(UTM_QUERY) as (keyof StoredUtm)[]).forEach((key) => {
    const value = sanitizeUtmValue(params.get(UTM_QUERY[key]), UTM_MAX[key]);
    if (value) out[key] = value;
  });
  return out;
}

export function mergeUtm(previous: StoredUtm | null | undefined, next: StoredUtm): StoredUtm {
  const merged: StoredUtm = { ...(previous || {}) };
  (Object.keys(UTM_QUERY) as (keyof StoredUtm)[]).forEach((key) => {
    if (next[key]) merged[key] = next[key];
  });
  return merged;
}

export function utmHasValues(utm: StoredUtm | null | undefined): boolean {
  if (!utm) return false;
  return (Object.keys(UTM_QUERY) as (keyof StoredUtm)[]).some((key) => Boolean(utm[key]));
}

/** GA4 measurement id. Anything else, including placeholders, is ignored. */
export function gaMeasurementId(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim();
  if (!/^G-[A-Z0-9]{6,12}$/.test(value)) return null;
  return value;
}

/** Meta Pixel id is numeric. No fallback id is ever returned. */
export function metaPixelId(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim();
  if (!/^\d{8,20}$/.test(value)) return null;
  return value;
}

/** Ad landing URL. Query strings (UTM) stay off the canonical path. */
export function productLandingPath(slug: string): string {
  const clean = String(slug || '').trim();
  return `/produto/${encodeURIComponent(clean)}`;
}
