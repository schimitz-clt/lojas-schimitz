import {
  ADMIN_ORDER_QUEUE_BUCKETS,
  PROBLEM_ORDER_STATUSES,
  statusesForAdminQueueBucket,
  type AdminOrderQueueBucket,
} from '../../common/order-status';

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

export type PlaceholderProductRef = {
  id: string;
  name: string;
  /** Primary image URL as stored (may be empty string when missing). Never invents photos. */
  imageUrl: string;
};

/** Id + name + imageUrl — owner checklist to replace placehold.co / empty photos. */
export function listPlaceholderProducts(
  products: Array<{
    id: string;
    name: string;
    images?: Array<{ url?: string | null }> | null;
  }>,
): PlaceholderProductRef[] {
  const out: PlaceholderProductRef[] = [];
  for (const p of products) {
    const raw = p.images?.[0]?.url;
    if (isMissingOrPlaceholderImage(raw)) {
      const imageUrl = typeof raw === 'string' ? raw.trim() : '';
      out.push({ id: p.id, name: p.name, imageUrl });
    }
  }
  return out;
}

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** CSV (id,name,imageUrl) for products needing real photos — no fake images generated. */
export function placeholderProductsCsv(rows: PlaceholderProductRef[]): {
  filename: string;
  csv: string;
} {
  const header = 'id,name,imageUrl';
  const lines = rows.map((r) =>
    [csvEscape(r.id), csvEscape(r.name), csvEscape(r.imageUrl)].join(','),
  );
  return {
    filename: 'products-needing-photos.csv',
    csv: [header, ...lines].join('\n') + '\n',
  };
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
export type OrderStatusCountRow = { status: string; count: number };

/** Aggregate raw Order.status groupBy into byStatus + operational buckets. */
export function summarizeOrderStatusCounts(rows: OrderStatusCountRow[]) {
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    const n = Number(row.count) || 0;
    byStatus[row.status] = (byStatus[row.status] || 0) + n;
    total += n;
  }
  const buckets: Record<AdminOrderQueueBucket, number> = {
    awaiting_payment: 0,
    paid: 0,
    organizing: 0,
    packing: 0,
    ready_for_pickup: 0,
    in_transit: 0,
    delivered: 0,
    problems: 0,
  };
  for (const bucket of ADMIN_ORDER_QUEUE_BUCKETS) {
    let sum = 0;
    for (const st of statusesForAdminQueueBucket(bucket)) {
      sum += byStatus[st] || 0;
    }
    buckets[bucket] = sum;
  }
  return {
    byStatus,
    buckets,
    problemsStatuses: [...PROBLEM_ORDER_STATUSES],
    total,
  };
}

export type OpsSalesWindow = {
  from: string;
  to: string;
  orderCount: number;
  revenue: number;
};

/** Pure sales window snapshot — numbers come from DB aggregates only. */
export function summarizeSalesWindow(input: {
  from: string;
  to: string;
  orderCount: number;
  revenue: number;
}): OpsSalesWindow {
  const orderCount = Math.max(0, Math.floor(Number(input.orderCount) || 0));
  const revenue = Math.round(((Number(input.revenue) || 0) + Number.EPSILON) * 100) / 100;
  return {
    from: input.from,
    to: input.to,
    orderCount,
    revenue,
  };
}

export type OpsAlertSeverity = 'info' | 'warn' | 'critical';

export type OpsAlert = {
  code: string;
  severity: OpsAlertSeverity;
  message: string;
  count: number;
  /** Optional queue bucket to filter when clicking the alert in admin UI. */
  queueBucket?: AdminOrderQueueBucket;
};

/**
 * Derive actionable ops alerts from real snapshot fields only.
 * No invented metrics — empty/zero conditions yield no alert.
 */
export function deriveOpsAlerts(input: {
  lowStockCount: number;
  outOfStockCount: number;
  placeholderProductCount: number;
  pendingPaymentCount: number;
  mailConfigured?: boolean;
  orderBuckets?: Partial<Record<AdminOrderQueueBucket, number>>;
}): OpsAlert[] {
  const alerts: OpsAlert[] = [];
  const out = Math.max(0, Number(input.outOfStockCount) || 0);
  const low = Math.max(0, Number(input.lowStockCount) || 0);
  const placeholders = Math.max(0, Number(input.placeholderProductCount) || 0);
  const pending = Math.max(0, Number(input.pendingPaymentCount) || 0);
  const buckets = input.orderBuckets || {};
  const problems = Math.max(0, Number(buckets.problems) || 0);
  const paid = Math.max(0, Number(buckets.paid) || 0);
  const awaiting = Math.max(0, Number(buckets.awaiting_payment) || 0);

  if (out > 0) {
    alerts.push({
      code: 'out_of_stock',
      severity: 'critical',
      message: `${out} produto(s) com estoque zerado`,
      count: out,
    });
  }
  if (low > 0) {
    alerts.push({
      code: 'low_stock',
      severity: 'warn',
      message: `${low} produto(s) com estoque baixo`,
      count: low,
    });
  }
  if (pending > 0) {
    alerts.push({
      code: 'pending_payments',
      severity: 'warn',
      message: `${pending} pagamento(s) pendente(s)`,
      count: pending,
      queueBucket: 'awaiting_payment',
    });
  }
  if (awaiting > 0) {
    alerts.push({
      code: 'awaiting_payment_orders',
      severity: 'info',
      message: `${awaiting} pedido(s) aguardando pagamento`,
      count: awaiting,
      queueBucket: 'awaiting_payment',
    });
  }
  if (paid > 0) {
    alerts.push({
      code: 'paid_needs_organizing',
      severity: 'warn',
      message: `${paid} pedido(s) pago(s) aguardando organizing`,
      count: paid,
      queueBucket: 'paid',
    });
  }
  if (problems > 0) {
    alerts.push({
      code: 'order_problems',
      severity: 'critical',
      message: `${problems} pedido(s) no bucket problemas`,
      count: problems,
      queueBucket: 'problems',
    });
  }
  if (placeholders > 0) {
    alerts.push({
      code: 'placeholder_photos',
      severity: 'info',
      message: `${placeholders} produto(s) com foto placeholder/ausente`,
      count: placeholders,
    });
  }
  if (input.mailConfigured === false) {
    alerts.push({
      code: 'mail_not_configured',
      severity: 'info',
      message: 'E-mail transacional não configurado (env ausente)',
      count: 0,
    });
  }
  return alerts;
}

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
  /** Cheap groupBy Order.status — optional for backward-compatible callers. */
  orderStatusCounts?: OrderStatusCountRow[];
  /** Optional sales windows already aggregated from DB (no fake numbers). */
  salesToday?: OpsSalesWindow;
  salesLast30d?: OpsSalesWindow;
}) {
  const base = summarizeInventoryOps({
    lowStockCount: input.lowStockCount,
    outOfStockCount: input.outOfStockCount,
    threshold: input.threshold,
    time: input.time,
  });
  const placeholderProducts = input.placeholderProducts ?? [];
  const orders = summarizeOrderStatusCounts(input.orderStatusCounts ?? []);
  const mailConfigured = Boolean(input.mailConfigured);
  const alerts = deriveOpsAlerts({
    lowStockCount: input.lowStockCount,
    outOfStockCount: input.outOfStockCount,
    placeholderProductCount: input.placeholderProductCount,
    pendingPaymentCount: input.pendingPaymentCount,
    mailConfigured,
    orderBuckets: orders.buckets,
  });
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
      configured: mailConfigured,
    },
    orders,
    sales: {
      today: input.salesToday ?? null,
      last30d: input.salesLast30d ?? null,
    },
    alerts,
  };
}
