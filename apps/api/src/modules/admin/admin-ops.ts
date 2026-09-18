import {
  ADMIN_ORDER_QUEUE_BUCKETS,
  PROBLEM_ORDER_STATUSES,
  STUCK_ORDER_STATUSES,
  TERMINAL_HISTORY_ORDER_STATUSES,
  countStatuses,
  statusesForAdminQueueBucket,
  type AdminOrderQueueBucket,
} from '../../common/order-status';

import {
  UPLOADS_PERSISTENT_ROOT,
  isUploadsDirPersistent,
  resolveUploadsDir,
  summarizeUploadsDurability,
  type UploadsDurabilitySummary,
} from '../uploads/uploads-durability';

export {
  UPLOADS_PERSISTENT_ROOT,
  isUploadsDirPersistent,
  resolveUploadsDir,
  summarizeUploadsDurability,
};
export type { UploadsDurabilitySummary };


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

export type PlaceholderPhotoReason = 'missing' | 'placeholder';

export type PlaceholderProductRef = {
  id: string;
  name: string;
  /** Primary image URL as stored (may be empty string when missing). Never invents photos. */
  imageUrl: string;
  /** missing = empty; placeholder = known demo host. Never invents photos. */
  reason: PlaceholderPhotoReason;
};

/** Classify why a product needs a real store photo (no invented images). */
export function placeholderPhotoReason(url?: string | null): PlaceholderPhotoReason {
  const t = typeof url === 'string' ? url.trim() : '';
  if (!t) return 'missing';
  return 'placeholder';
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
      out.push({
        id: p.id,
        name: p.name,
        imageUrl,
        reason: placeholderPhotoReason(imageUrl),
      });
    }
  }
  return out;
}

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** CSV (id,name,imageUrl,reason) for products needing real photos — no fake images generated. */
export function placeholderProductsCsv(rows: PlaceholderProductRef[]): {
  filename: string;
  csv: string;
} {
  const header = 'id,name,imageUrl,reason';
  const lines = rows.map((r) =>
    [
      csvEscape(r.id),
      csvEscape(r.name),
      csvEscape(r.imageUrl),
      csvEscape(r.reason || placeholderPhotoReason(r.imageUrl)),
    ].join(','),
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
    stuckStatuses: [...STUCK_ORDER_STATUSES],
    terminalHistoryStatuses: [...TERMINAL_HISTORY_ORDER_STATUSES],
    /** Legado stuck only — fonte do alerta CRITICAL order_problems. */
    stuckCount: countStatuses(byStatus, STUCK_ORDER_STATUSES),
    /** Cancelado/reembolsado — histórico; não gera alerta crítico. */
    terminalHistoryCount: countStatuses(byStatus, TERMINAL_HISTORY_ORDER_STATUSES),
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

export type OpsAlertSeverity = 'info' | 'warn' | 'high' | 'critical';

export type OpsAlertSection = 'reconciliations' | 'orders' | 'inventory' | 'catalog';

export type OpsReconciliationRecent = {
  id: string;
  reason: string;
  providerStatus: string;
  externalReference: string | null;
  createdAt: string;
  status: string;
};

export type OpsReconciliationsSummary = {
  openCount: number;
  recent: OpsReconciliationRecent[];
};

export type OpsAlert = {
  code: string;
  /** Human PT label for Command Center (alongside machine code). */
  label: string;
  severity: OpsAlertSeverity;
  message: string;
  count: number;
  /** Optional queue bucket to filter when clicking the alert in admin UI. */
  queueBucket?: AdminOrderQueueBucket;
  /** Optional admin UI section deep-link (e.g. reconciliations list). */
  section?: OpsAlertSection;
  /** Compact evidence for human review — never secrets. */
  evidence?: {
    reason?: string;
    providerStatus?: string;
    externalReference?: string | null;
    ids?: string[];
  };
  /** Human-in-the-loop hint only — never auto-execute. */
  recommendedAction?: string;
};

export const OPS_ALERT_LABELS_PT: Record<string, string> = {
  out_of_stock: 'Estoque zerado',
  low_stock: 'Estoque baixo',
  pending_payments: 'Pagamentos pendentes',
  awaiting_payment_orders: 'Aguardando pagamento',
  paid_needs_organizing: 'Pagos para organizar',
  paid_stuck_awaiting_org: 'Pagos travados',
  order_problems: 'Pedidos legados travados',
  order_terminal_history: 'Cancelados/reembolsados',
  placeholder_photos: 'Fotos placeholder',
  open_reconciliations: 'Pagamentos a conciliar',
  mail_off_with_store_notify: 'E-mail da loja desligado',
  mail_not_configured: 'E-mail transacional ausente',
  uploads_ephemeral: 'Uploads efêmeros',
  store_email_send_failed: 'Falha ao enviar e-mail da loja',
  store_email_no_recipients: 'Sem destinatário de e-mail da loja',
};

export const OPS_ALERT_SEVERITY_LABELS_PT: Record<OpsAlertSeverity, string> = {
  critical: 'Crítico',
  high: 'Alto',
  warn: 'Atenção',
  info: 'Info',
};

export function opsAlertLabelPt(code: string): string {
  return OPS_ALERT_LABELS_PT[code] || code;
}

export function opsAlertSeverityLabelPt(severity: string): string {
  if (severity === 'critical' || severity === 'high' || severity === 'warn' || severity === 'info') {
    return OPS_ALERT_SEVERITY_LABELS_PT[severity];
  }
  return severity;
}

const OPS_ALERT_SEVERITY_RANK: Record<OpsAlertSeverity, number> = {
  critical: 0,
  high: 1,
  warn: 2,
  info: 3,
};

function pushOpsAlert(alerts: OpsAlert[], partial: Omit<OpsAlert, 'label'> & { label?: string }): void {
  alerts.push({
    ...partial,
    label: partial.label || opsAlertLabelPt(partial.code),
  });
}

export type OpsStoreNotifyMailFailure = {
  code: string;
  publicId: string;
  reason: string;
  at: string;
};

export type OpsMailSummary = {
  configured: boolean;
  storeNotifyConfigured: boolean;
  /** Real env mismatch hint — not an invented counter; no e-mail on ops poll. */
  providerOffWithStoreNotify: boolean;
  /** Unique DB∪env recipients (count only — never addresses). Null when caller omitted. */
  recipientCount: number | null;
  /** Process-local recent store-notify failures (empty after API restart is honest). */
  recentFailures: OpsStoreNotifyMailFailure[];
  failureCount: number;
};

/**
 * Derive actionable ops alerts from real snapshot fields only.
 * No invented metrics — empty/zero conditions yield no alert.
 */
/** Cap recent reconciliations embedded in ops snapshot (command center). */
export const OPS_RECONCILIATIONS_RECENT_CAP = 10;

/** Hours a paid order may wait before ops treats it as stuck awaiting organization. */
export const PAID_STUCK_HOURS = 24;

/** Cap stuck publicIds/ids embedded in ops alerts (command center evidence). */
export const PAID_STUCK_IDS_CAP = 20;

export type PaidAwaitingOrgOrderRef = {
  id: string;
  publicId: string;
  /** Prefer statusHistory paid timestamp when available; else createdAt. */
  since: string | Date;
};

export type PaidAwaitingOrgSummary = {
  stuckHoursThreshold: number;
  paidAwaitingCount: number;
  stuckCount: number;
  stuckPublicIds: string[];
  stuckIds: string[];
  /** Oldest stuck age in whole hours (floor); null when none stuck. */
  oldestStuckHours: number | null;
};

/** Elapsed hours since `since` (non-negative; invalid dates → 0). */
export function hoursSince(since: string | Date, now: Date = new Date()): number {
  const t = since instanceof Date ? since.getTime() : new Date(since).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (now.getTime() - t) / (1000 * 60 * 60));
}

export function isPaidStuck(
  since: string | Date,
  thresholdHours: number = PAID_STUCK_HOURS,
  now: Date = new Date(),
): boolean {
  return hoursSince(since, now) >= thresholdHours;
}

/** Severity for stuck paid-awaiting-org: high at threshold, critical at 2× or many. */
export function paidStuckSeverity(
  stuckCount: number,
  oldestStuckHours: number | null,
  thresholdHours: number = PAID_STUCK_HOURS,
): OpsAlertSeverity {
  if (stuckCount <= 0) return 'info';
  const oldest = oldestStuckHours ?? 0;
  if (oldest >= thresholdHours * 2 || stuckCount >= 5) return 'critical';
  if (oldest >= thresholdHours || stuckCount >= 1) return 'high';
  return 'warn';
}

/**
 * Summarize paid orders still awaiting organization (status === paid).
 * Pure — no DB. `since` should be paidAt when known, else createdAt.
 */
export function summarizePaidAwaitingOrg(input: {
  orders: PaidAwaitingOrgOrderRef[];
  thresholdHours?: number;
  now?: Date;
  idsCap?: number;
}): PaidAwaitingOrgSummary {
  const thresholdHours = input.thresholdHours ?? PAID_STUCK_HOURS;
  const now = input.now ?? new Date();
  const idsCap = input.idsCap ?? PAID_STUCK_IDS_CAP;
  const paidAwaitingCount = input.orders.length;
  const stuck = input.orders
    .map((o) => ({
      ...o,
      hours: hoursSince(o.since, now),
    }))
    .filter((o) => o.hours >= thresholdHours)
    .sort((a, b) => b.hours - a.hours);
  const stuckPublicIds = stuck.slice(0, idsCap).map((o) => String(o.publicId));
  const stuckIds = stuck.slice(0, idsCap).map((o) => String(o.id));
  const oldestStuckHours =
    stuck.length === 0 ? null : Math.floor(stuck[0]!.hours);
  return {
    stuckHoursThreshold: thresholdHours,
    paidAwaitingCount,
    stuckCount: stuck.length,
    stuckPublicIds,
    stuckIds,
    oldestStuckHours,
  };
}


/** Normalize open reconciliation rows for ops snapshot — no secrets. */
export function summarizeReconciliations(input: {
  openCount: number;
  recent?: Array<{
    id: string;
    reason: string;
    providerStatus: string;
    externalReference?: string | null;
    createdAt: string | Date;
    status: string;
  }>;
}): OpsReconciliationsSummary {
  const openCount = Math.max(0, Math.floor(Number(input.openCount) || 0));
  const recent = (input.recent ?? []).slice(0, OPS_RECONCILIATIONS_RECENT_CAP).map((r) => ({
    id: String(r.id),
    reason: String(r.reason || ''),
    providerStatus: String(r.providerStatus || ''),
    externalReference: r.externalReference == null ? null : String(r.externalReference),
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || ''),
    status: String(r.status || ''),
  }));
  return { openCount, recent };
}

export function deriveOpsAlerts(input: {
  lowStockCount: number;
  outOfStockCount: number;
  placeholderProductCount: number;
  pendingPaymentCount: number;
  mailConfigured?: boolean;
  /** STORE_NOTIFY_EMAIL env present (name only) — never secret values. */
  storeNotifyConfigured?: boolean;
  orderBuckets?: Partial<Record<AdminOrderQueueBucket, number>>;
  /**
   * Legado stuck (separating/shipped) — ONLY this count drives CRITICAL order_problems.
   * Do not pass buckets.problems here: that bucket also includes cancelled/refunded history.
   */
  stuckOrderCount?: number;
  /** Cancelled+refunded history — info only; never critical. */
  terminalHistoryCount?: number;
  /** Open PaymentReconciliation rows — real DB count only. */
  openReconciliationCount?: number;
  /** Optional sample for evidence (capped). */
  reconciliationRecent?: OpsReconciliationRecent[];
  /** Paid (status=paid) still awaiting organization — stuck slice. */
  paidAwaitingOrg?: PaidAwaitingOrgSummary;
  /**
   * Uploads durability — pass only when known.
   * Alert fires solely when explicitly false (ephemeral); undefined skips (no fake metric).
   */
  uploadsPersistent?: boolean;
  /** Optional resolved dir for evidence (ops). */
  uploadsDir?: string;
  /**
   * Unique store-notify recipients (DB∪env). Pass only when counted.
   * Alert fires solely when explicitly 0 and mail is configured; undefined skips.
   */
  mailRecipientCount?: number;
  /** Process-local recent store-notify failures — empty is honest, not a KPI. */
  storeNotifyRecentFailures?: OpsStoreNotifyMailFailure[];
}): OpsAlert[] {
  const alerts: OpsAlert[] = [];
  const out = Math.max(0, Number(input.outOfStockCount) || 0);
  const low = Math.max(0, Number(input.lowStockCount) || 0);
  const placeholders = Math.max(0, Number(input.placeholderProductCount) || 0);
  const pending = Math.max(0, Number(input.pendingPaymentCount) || 0);
  const buckets = input.orderBuckets || {};
  const stuck = Math.max(0, Number(input.stuckOrderCount) || 0);
  const terminalHistory = Math.max(0, Number(input.terminalHistoryCount) || 0);
  const paid = Math.max(0, Number(buckets.paid) || 0);
  const awaiting = Math.max(0, Number(buckets.awaiting_payment) || 0);
  const openRecon = Math.max(0, Number(input.openReconciliationCount) || 0);
  const mailFailures = input.storeNotifyRecentFailures ?? [];
  const sendFailed = mailFailures.filter((f) => f.code === 'STORE_EMAIL_SEND_FAILED');
  const noRecipientEvents = mailFailures.filter((f) => f.code === 'STORE_EMAIL_NO_RECIPIENTS');
  const providerOffEvents = mailFailures.filter(
    (f) => f.code === 'MAIL_PROVIDER_OFF_STORE_NOTIFY' || f.code === 'MAIL_PROVIDER_OFF',
  );

  if (out > 0) {
    pushOpsAlert(alerts, {
      code: 'out_of_stock',
      severity: 'critical',
      message: `${out} produto(s) com estoque zerado`,
      count: out,
    });
  }
  if (low > 0) {
    pushOpsAlert(alerts, {
      code: 'low_stock',
      severity: 'warn',
      message: `${low} produto(s) com estoque baixo`,
      count: low,
    });
  }
  if (pending > 0) {
    pushOpsAlert(alerts, {
      code: 'pending_payments',
      severity: 'warn',
      message: `${pending} pagamento(s) pendente(s)`,
      count: pending,
      queueBucket: 'awaiting_payment',
    });
  }
  if (awaiting > 0) {
    pushOpsAlert(alerts, {
      code: 'awaiting_payment_orders',
      severity: 'info',
      message: `${awaiting} pedido(s) aguardando pagamento`,
      count: awaiting,
      queueBucket: 'awaiting_payment',
    });
  }
  if (paid > 0) {
    pushOpsAlert(alerts, {
      code: 'paid_needs_organizing',
      severity: 'warn',
      message: `${paid} pedido(s) pago(s) aguardando organização`,
      count: paid,
      queueBucket: 'paid',
      recommendedAction:
        'Abrir fila Pagos → Separar (Organizando). Pagamento não avança sozinho.',
    });
  }
  const paidOrg = input.paidAwaitingOrg;
  const stuckCount = Math.max(0, Number(paidOrg?.stuckCount) || 0);
  if (stuckCount > 0 && paidOrg) {
    const threshold = paidOrg.stuckHoursThreshold ?? PAID_STUCK_HOURS;
    const oldest = paidOrg.oldestStuckHours;
    const sev = paidStuckSeverity(stuckCount, oldest, threshold);
    pushOpsAlert(alerts, {
      code: 'paid_stuck_awaiting_org',
      severity: sev,
      message: `${stuckCount} pedido(s) pago(s) travado(s) há ≥${threshold}h sem organização${
        oldest != null ? ` (mais antigo ~${oldest}h)` : ''
      }`,
      count: stuckCount,
      queueBucket: 'paid',
      evidence: {
        reason: `paid_stuck_${threshold}h`,
        ids: (paidOrg.stuckPublicIds?.length
          ? paidOrg.stuckPublicIds
          : paidOrg.stuckIds
        ).slice(0, PAID_STUCK_IDS_CAP),
      },
      recommendedAction:
        'Separar agora (Organizando). Se a loja não recebeu aviso de venda, use Reenviar aviso loja / confira STORE_NOTIFY_EMAIL.',
    });
  }
  if (stuck > 0) {
    pushOpsAlert(alerts, {
      code: 'order_problems',
      severity: 'critical',
      message: `${stuck} pedido(s) legado(s) travado(s) (separando/saiu para entrega)`,
      count: stuck,
      queueBucket: 'problems',
      recommendedAction:
        'Avançar fulfillment (Embalagem / Entregue) ou fechar o pedido legado. Cancelados/reembolsados não entram neste alerta.',
    });
  }
  if (terminalHistory > 0) {
    pushOpsAlert(alerts, {
      code: 'order_terminal_history',
      severity: 'info',
      message: `${terminalHistory} pedido(s) cancelado(s)/reembolsado(s) (histórico — não é fila crítica)`,
      count: terminalHistory,
      queueBucket: 'problems',
    });
  }
  if (placeholders > 0) {
    pushOpsAlert(alerts, {
      code: 'placeholder_photos',
      severity: 'info',
      message: `${placeholders} produto(s) com foto placeholder/ausente`,
      count: placeholders,
      section: 'catalog',
      recommendedAction:
        'Abrir Catálogo → fila Sem foto / placeholder. Envie foto real na lista (não inventar imagem).',
    });
  }
  if (openRecon > 0) {
    const sample = (input.reconciliationRecent ?? []).slice(0, 3);
    const moneyRisk = sample.some((r) => {
      const s = String(r.providerStatus || '').toLowerCase();
      return s === 'approved' || s === 'paid';
    });
    pushOpsAlert(alerts, {
      code: 'open_reconciliations',
      // Approved/paid orphans are money-at-risk → critical so they lead ATENÇÃO AGORA.
      severity: moneyRisk ? 'critical' : 'high',
      message: `${openRecon} pagamento(s) no provedor SEM pedido local — abrir fila Reconciliações agora${
        moneyRisk ? ' (provedor aprovou/pagou; possível captura sem Payment local)' : ''
      }`,
      count: openRecon,
      section: 'reconciliations',
      evidence: {
        reason: sample[0]?.reason,
        providerStatus: sample[0]?.providerStatus,
        externalReference: sample[0]?.externalReference ?? null,
        ids: sample.map((r) => r.id),
      },
      recommendedAction:
        'Abrir Reconciliações, conferir ref/publicId no Mercado Pago e decidir na mão. Não estornar, marcar pago nem ajustar estoque automaticamente.',
    });
  }
  if (sendFailed.length > 0) {
    const last = sendFailed[0];
    pushOpsAlert(alerts, {
      code: 'store_email_send_failed',
      severity: 'high',
      message: `${sendFailed.length} falha(s) ao enviar e-mail da loja após pagamento (nesta instância da API)${
        last?.publicId ? ` — último: ${last.publicId}` : ''
      }`,
      count: sendFailed.length,
      queueBucket: 'paid',
      evidence: {
        reason: last?.reason || 'send_failed',
        ids: sendFailed.map((f) => f.publicId).filter(Boolean).slice(0, 8),
      },
      recommendedAction:
        'Abrir fila Pagos e usar Reenviar aviso loja. Pagamento não é revertido. Confira Resend / MAIL_FROM.',
    });
  }
  const recipientCountKnown = input.mailRecipientCount != null;
  const noRecipientsNow =
    recipientCountKnown &&
    input.mailConfigured === true &&
    Number(input.mailRecipientCount) === 0;
  if (noRecipientsNow || noRecipientEvents.length > 0) {
    const last = noRecipientEvents[0];
    pushOpsAlert(alerts, {
      code: 'store_email_no_recipients',
      severity: input.mailConfigured === true ? 'high' : 'warn',
      message: noRecipientsNow
        ? 'E-mail da loja configurado, mas nenhum destinatário (STORE_NOTIFY_EMAIL / admins reais) — avisos de venda não saem'
        : `E-mail da loja não tentado: sem destinatários${
            last?.publicId ? ` — último: ${last.publicId}` : ''
          }`,
      count: noRecipientsNow ? 0 : noRecipientEvents.length,
      queueBucket: 'paid',
      evidence: {
        reason: 'no_recipients',
        ids: noRecipientEvents.map((f) => f.publicId).filter(Boolean).slice(0, 8),
      },
      recommendedAction:
        'Defina STORE_NOTIFY_EMAIL com a caixa do dono (não noreply). Reenviar aviso loja só gera in-app até haver destinatário.',
    });
  }
  if (input.mailConfigured === false && input.storeNotifyConfigured === true) {
    pushOpsAlert(alerts, {
      code: 'mail_off_with_store_notify',
      severity: 'warn',
      message:
        'STORE_NOTIFY_EMAIL configurado mas provider de e-mail off (MAIL_FROM + RESEND_API_KEY|SMTP) — avisos de venda não saem por e-mail',
      count: providerOffEvents.length,
      queueBucket: 'paid',
      evidence: {
        reason: 'provider_off',
        ids: providerOffEvents.map((f) => f.publicId).filter(Boolean).slice(0, 8),
      },
      recommendedAction:
        'Configure MAIL_FROM + RESEND_API_KEY (ou SMTP). Não disparamos e-mail neste poll. Pedido pago continua válido.',
    });
  } else if (input.mailConfigured === false) {
    pushOpsAlert(alerts, {
      code: 'mail_not_configured',
      severity: 'info',
      message: 'E-mail transacional não configurado (env ausente)',
      count: 0,
    });
  }
  if (input.uploadsPersistent === false) {
    const dirHint = input.uploadsDir ? ` (${input.uploadsDir})` : '';
    pushOpsAlert(alerts, {
      code: 'uploads_ephemeral',
      severity: 'warn',
      message: `UPLOADS_DIR fora de /data${dirHint} — disco efêmero; fotos somem no redeploy sem Volume Railway`,
      count: 0,
      evidence: {
        reason: 'uploads_dir_not_under_/data',
      },
      recommendedAction:
        'Montar Volume em /data/uploads e definir UPLOADS_DIR=/data/uploads (OWNER/ops). Não movemos arquivos neste poll.',
    });
  }
  return alerts.sort(
    (a, b) =>
      (OPS_ALERT_SEVERITY_RANK[a.severity] ?? 9) - (OPS_ALERT_SEVERITY_RANK[b.severity] ?? 9),
  );
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
  /** STORE_NOTIFY_EMAIL env present (name only). */
  storeNotifyConfigured?: boolean;
  /** Cheap groupBy Order.status — optional for backward-compatible callers. */
  orderStatusCounts?: OrderStatusCountRow[];
  /** Optional sales windows already aggregated from DB (no fake numbers). */
  salesToday?: OpsSalesWindow;
  salesLast30d?: OpsSalesWindow;
  /** Optional open PaymentReconciliation summary (real DB only). */
  reconciliations?: OpsReconciliationsSummary;
  /** Optional paid-awaiting-org stuck summary (real DB rows only). */
  paidAwaitingOrg?: PaidAwaitingOrgSummary;
  /** Uploads durability snapshot (real path check only). */
  uploads?: UploadsDurabilitySummary;
  /** Unique store-notify recipients (count only). Omit to skip durable no-recipient alert. */
  mailRecipientCount?: number;
  /** Process-local store-notify failures (empty after restart is honest). */
  storeNotifyMail?: {
    recentFailures?: OpsStoreNotifyMailFailure[];
    failureCount?: number;
  };
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
  const reconciliations = input.reconciliations
    ? summarizeReconciliations(input.reconciliations)
    : summarizeReconciliations({ openCount: 0, recent: [] });
  const paidAwaitingOrg =
    input.paidAwaitingOrg ??
    summarizePaidAwaitingOrg({ orders: [] });
  const storeNotifyConfigured = Boolean(input.storeNotifyConfigured);
  const uploads = input.uploads;
  const recentFailures = (input.storeNotifyMail?.recentFailures ?? []).map((f) => ({
    code: String(f.code || ''),
    publicId: String(f.publicId || ''),
    reason: String(f.reason || ''),
    at: String(f.at || ''),
  }));
  const mailRecipientCount =
    input.mailRecipientCount == null
      ? null
      : Math.max(0, Math.floor(Number(input.mailRecipientCount) || 0));
  const alerts = deriveOpsAlerts({
    lowStockCount: input.lowStockCount,
    outOfStockCount: input.outOfStockCount,
    placeholderProductCount: input.placeholderProductCount,
    pendingPaymentCount: input.pendingPaymentCount,
    mailConfigured,
    storeNotifyConfigured,
    orderBuckets: orders.buckets,
    stuckOrderCount: orders.stuckCount,
    terminalHistoryCount: orders.terminalHistoryCount,
    openReconciliationCount: reconciliations.openCount,
    reconciliationRecent: reconciliations.recent,
    paidAwaitingOrg,
    uploadsPersistent: uploads ? uploads.persistent : undefined,
    uploadsDir: uploads?.dir,
    mailRecipientCount: mailRecipientCount == null ? undefined : mailRecipientCount,
    storeNotifyRecentFailures: recentFailures,
  });
  const mail: OpsMailSummary = {
    configured: mailConfigured,
    storeNotifyConfigured,
    providerOffWithStoreNotify: mailConfigured === false && storeNotifyConfigured === true,
    recipientCount: mailRecipientCount,
    recentFailures,
    failureCount: recentFailures.length,
  };
  return {
    ...base,
    catalog: {
      placeholderProductCount: input.placeholderProductCount,
      placeholderProducts,
    },
    payments: {
      pendingCount: input.pendingPaymentCount,
    },
    reconciliations,
    mail,
    /** Real UPLOADS_DIR path check — null when caller omitted (no invented durability). */
    uploads: uploads ?? null,
    orders,
    paidAwaitingOrg,
    sales: {
      today: input.salesToday ?? null,
      last30d: input.salesLast30d ?? null,
    },
    alerts,
  };
}
