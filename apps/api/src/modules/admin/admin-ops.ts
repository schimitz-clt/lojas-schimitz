/**
 * Health-adjacent admin ops helpers.
 * Counts + id/name checklist for owner photo replacement.
 * No product/payment dump. Default threshold matches admin UI (5).
 */

export const DEFAULT_OPS_LOW_STOCK_THRESHOLD = 5;

const PLACEHOLDER_HOSTS = new Set([
  'placehold.co',
  'www.placehold.co',
  'placehold.it',
  'www.placehold.it',
  'via.placeholder.com',
  'placeholder.com',
  'www.placeholder.com',
]);

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when the URL is a known demo/placeholder host (not merely empty). */
export function isPlaceholderImageUrl(url?: string | null): boolean {
  const t = typeof url === 'string' ? url.trim() : '';
  if (!t) return false;
  const lower = t.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === '#' || lower === 'about:blank') {
    return true;
  }
  const host = hostnameOf(t);
  if (host) {
    if (PLACEHOLDER_HOSTS.has(host)) return true;
    if (host.endsWith('.placehold.co') || host.endsWith('.placehold.it')) return true;
    return false;
  }
  return /placehold\.co|placehold\.it|via\.placeholder\.com/i.test(t);
}

/** Empty/whitespace or placeholder host — treat as missing photo. */
export function isMissingOrPlaceholderImage(url?: string | null): boolean {
  const t = typeof url === 'string' ? url.trim() : '';
  if (!t) return true;
  return isPlaceholderImageUrl(t);
}

export function isLowOnHand(
  qtyOnHand: number | null | undefined,
  threshold = DEFAULT_OPS_LOW_STOCK_THRESHOLD,
): boolean {
  if (qtyOnHand == null || !Number.isFinite(qtyOnHand)) return false;
  return qtyOnHand <= threshold;
}

/** Count products whose primary image is missing or a demo placeholder. */
export function countPlaceholderProducts(
  products: Array<{ images?: Array<{ url?: string | null }> | null }>,
): number {
  let n = 0;
  for (const p of products) {
    const url = p.images?.[0]?.url;
    if (isMissingOrPlaceholderImage(url)) n += 1;
  }
  return n;
}

export type PlaceholderProductRef = { id: string; name: string };

/** Id + name only — owner checklist to replace placehold.co / empty photos. */
export function listPlaceholderProducts(
  products: Array<{
    id: string;
    name: string;
    images?: Array<{ url?: string | null }> | null;
  }>,
): PlaceholderProductRef[] {
  const out: PlaceholderProductRef[] = [];
  for (const p of products) {
    if (isMissingOrPlaceholderImage(p.images?.[0]?.url)) {
      out.push({ id: p.id, name: p.name });
    }
  }
  return out;
}

export function summarizeInventoryOps(input: {
  lowStockCount: number;
  outOfStockCount: number;
  threshold?: number;
  time?: string;
}) {
  return {
    time: input.time || new Date().toISOString(),
    inventory: {
      lowStockThreshold: input.threshold ?? DEFAULT_OPS_LOW_STOCK_THRESHOLD,
      lowStockCount: input.lowStockCount,
      outOfStockCount: input.outOfStockCount,
    },
  };
}

/** Full ops snapshot: inventory + catalog placeholders + pending payments. */
export function summarizeOps(input: {
  lowStockCount: number;
  outOfStockCount: number;
  placeholderProductCount: number;
  pendingPaymentCount: number;
  placeholderProducts?: PlaceholderProductRef[];
  threshold?: number;
  time?: string;
  /** Env-name presence only — never secret values. */
  mailConfigured?: boolean;
}) {
  const base = summarizeInventoryOps({
    lowStockCount: input.lowStockCount,
    outOfStockCount: input.outOfStockCount,
    threshold: input.threshold,
    time: input.time,
  });
  const placeholderProducts = input.placeholderProducts ?? [];
  return {
    ...base,
    catalog: {
      placeholderProductCount: input.placeholderProductCount,
      placeholderProducts,
    },
    payments: {
      pendingCount: input.pendingPaymentCount,
    },
    mail: {
      configured: Boolean(input.mailConfigured),
    },
  };
}
