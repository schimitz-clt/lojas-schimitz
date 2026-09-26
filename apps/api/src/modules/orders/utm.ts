/**
 * Paid-traffic attribution stored on the order.
 * Invalid or missing values become null — they never block checkout.
 */

const UTM_KEYS = ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm'] as const;

export type OrderUtmKey = (typeof UTM_KEYS)[number];
export type OrderUtm = Record<OrderUtmKey, string | null>;

const MAX: Record<OrderUtmKey, number> = {
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

export function sanitizeOrderUtm(input: Partial<Record<OrderUtmKey, unknown>> | null | undefined): OrderUtm {
  const out = {} as OrderUtm;
  for (const key of UTM_KEYS) {
    out[key] = sanitizeUtmValue(input?.[key], MAX[key]);
  }
  return out;
}

export function orderUtmIsEmpty(utm: OrderUtm): boolean {
  return UTM_KEYS.every((key) => !utm[key]);
}
