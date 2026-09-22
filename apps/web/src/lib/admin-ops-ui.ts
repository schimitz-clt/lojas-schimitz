/**
 * Pure helpers for Admin ops polish (paid queue / Separar / copy / payment badge).
 * No network — safe to unit-test without DOM.
 */

export type AdminPaymentLike = {
  status?: string | null;
  method?: string | null;
  amount?: number | string | null;
};

export type PaymentMethodKind = 'pix' | 'card' | 'other';

export type PaymentMethodBadge = {
  kind: PaymentMethodKind;
  /** Short PT label for badge: PIX | Cartão | method raw */
  label: string;
  amount: number | null;
  status: string | null;
};

const PAIDISH = new Set(['approved', 'paid', 'authorized', 'captured']);

function normalizeMethod(raw?: string | null): PaymentMethodKind | null {
  const m = String(raw || '')
    .trim()
    .toLowerCase();
  if (!m) return null;
  if (m === 'pix') return 'pix';
  if (m === 'card' || m === 'credit_card' || m === 'debit_card' || m.includes('card')) {
    return 'card';
  }
  return 'other';
}

export function paymentMethodLabelPt(kind: PaymentMethodKind | null, raw?: string | null): string | null {
  if (kind === 'pix') return 'PIX';
  if (kind === 'card') return 'Cartão';
  const m = String(raw || '').trim();
  return m || null;
}

/**
 * Pick the most relevant payment for ops badge: prefer paid/approved with method,
 * else first with method, else first row.
 */
export function pickPrimaryPayment(
  payments?: AdminPaymentLike[] | null,
): AdminPaymentLike | null {
  const list = (payments || []).filter(Boolean);
  if (!list.length) return null;
  const paid = list.find(
    (p) => PAIDISH.has(String(p.status || '').toLowerCase()) && p.method,
  );
  if (paid) return paid;
  const withMethod = list.find((p) => p.method);
  return withMethod || list[0];
}

/** Badge for paid / early-ops rows when API returns method (and optional amount). */
export function paymentMethodBadge(
  payments?: AdminPaymentLike[] | null,
): PaymentMethodBadge | null {
  const p = pickPrimaryPayment(payments);
  if (!p) return null;
  const kind = normalizeMethod(p.method);
  const label = paymentMethodLabelPt(kind, p.method);
  if (!label) return null;
  const amountNum =
    p.amount != null && p.amount !== '' && Number.isFinite(Number(p.amount))
      ? Number(p.amount)
      : null;
  return {
    kind: kind || 'other',
    label,
    amount: amountNum,
    status: p.status ? String(p.status) : null,
  };
}

export type CopyKind = 'publicId' | 'tracking';

export function copySuccessMessage(kind: CopyKind, value: string): string {
  const v = (value || '').trim();
  if (kind === 'tracking') return `Rastreio copiado: ${v}`;
  return `publicId copiado: ${v}`;
}

/** Clipboard write with legacy fallback — browser only. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const v = String(text || '');
  if (!v) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(v);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = v;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Stronger Separar labels — same status machine, clearer ops CTA. */
export function separarPrimaryLabel(status: string, next: string): string | null {
  if (status === 'paid' && next === 'organizing') return 'Separar agora';
  if (status === 'organizing' && next === 'packing') return 'Separar (Embalagem)';
  if (status === 'separating' && next === 'packing') return 'Separar (Embalagem)';
  return null;
}

export function advanceSuccessMessage(publicId: string, nextStatusLabel: string): string {
  return `Pedido ${publicId} → ${nextStatusLabel}.`;
}

export function emptyOrdersQueueMessage(opts: {
  hasSearch: boolean;
  roiFilter: 'all' | 'stuck_paid' | 'no_shipping' | string;
  statusFilter: string;
  paidBucketLabel?: string;
}): string {
  if (opts.hasSearch || opts.roiFilter !== 'all') {
    if (opts.roiFilter === 'stuck_paid') {
      return 'Nenhum pago travado (≥24h) na lista atual. Bom sinal — confira o bucket Pagos se a fila ops mostrar contagem.';
    }
    return 'Nenhum pedido corresponde à busca/filtro ROI (servidor se ≥3 ou SCH-…).';
  }
  if (opts.statusFilter === 'paid') {
    return 'Fila Pagos vazia — nada aguardando Separar no momento. Atualize o Centro de comando se acabou de marcar Organizando.';
  }
  if (opts.statusFilter) {
    const label = opts.paidBucketLabel || opts.statusFilter;
    return `Nenhum pedido no bucket “${label}”.`;
  }
  return 'Nenhum pedido ainda.';
}

/** WhatsApp CTA copy: prefer explicit “cliente” when resolveOrderWhatsApp.toCustomer. */
export function whatsAppOpsButtonLabel(
  toCustomer: boolean,
  kind: 'generic' | 'paid' | 'shipped' = 'generic',
): string {
  if (kind === 'paid') {
    return toCustomer
      ? 'WhatsApp cliente (pago)'
      : 'WhatsApp loja (cliente sem tel.)';
  }
  if (kind === 'shipped') {
    return toCustomer
      ? 'WhatsApp cliente (saiu)'
      : 'WhatsApp loja (cliente sem tel.)';
  }
  return toCustomer ? 'WhatsApp cliente' : 'WhatsApp loja (rascunho)';
}

export type OpsAlertSeverityLike = 'critical' | 'high' | 'warn' | 'info' | string;

/** Ops home questions — copy only; counts come from the snapshot. */
export const OPS_NOW_HEADING = 'O que está acontecendo agora?';
export const OPS_ATTENTION_HEADING = 'O que precisa de atenção?';
export const OPS_DO_HEADING = 'O que posso fazer agora?';

export const OPS_NOW_LEDE =
  'Receita, filas e situação deste GET /admin/ops. Zero continua zero. Sem snapshot, o valor fica —.';

export const OPS_DO_LEDE =
  'Atalhos para seções que já existem. Nenhum deles grava, estorna ou resolve sozinho.';

/**
 * Quick actions are navigation only. Hints never invent a count —
 * a live figure is added separately when the snapshot actually has one.
 */
export const OPS_QUICK_ACTIONS = [
  { id: 'paid', label: 'Organizar pagos', hint: 'Abre Pedidos no bucket Pago' },
  { id: 'photos', label: 'Trocar fotos', hint: 'Abre Catálogo na fila de fotos' },
  { id: 'catalog', label: 'Catálogo', hint: 'Abre produtos e estoque' },
  { id: 'recon', label: 'Reconciliações', hint: 'Rola até a fila nesta página' },
  { id: 'push', label: 'Nova campanha', hint: 'Abre Notificações' },
  { id: 'orders', label: 'Fila de pedidos', hint: 'Abre Pedidos' },
  { id: 'vendas', label: 'Vendas', hint: 'Abre o relatório' },
  { id: 'clientes', label: 'Clientes', hint: 'Abre o CRM' },
] as const;

export type OpsQuickActionId = (typeof OPS_QUICK_ACTIONS)[number]['id'];

export type OpsQuickActionSnapshot = {
  paidAwaiting?: number | null;
  ordersTotal?: number | null;
  placeholderPhotos?: number | null;
  lowStock?: number | null;
  outOfStock?: number | null;
  openRecon?: number | null;
};

function finiteCount(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return String(Math.trunc(Number(value)));
}

/** Live figure for a quick action. Null when the snapshot has no such field — never a guessed 0. */
export function opsQuickActionFigure(
  id: OpsQuickActionId,
  snap: OpsQuickActionSnapshot | null | undefined,
): string | null {
  if (!snap) return null;
  if (id === 'paid') {
    const n = finiteCount(snap.paidAwaiting);
    return n == null ? null : `${n} no snapshot`;
  }
  if (id === 'orders') {
    const n = finiteCount(snap.ordersTotal);
    return n == null ? null : `${n} no snapshot`;
  }
  if (id === 'photos') {
    const n = finiteCount(snap.placeholderPhotos);
    return n == null ? null : `${n} no snapshot`;
  }
  if (id === 'catalog') {
    const low = finiteCount(snap.lowStock);
    const out = finiteCount(snap.outOfStock);
    if (low == null && out == null) return null;
    const bits = [
      low != null ? `estoque baixo ${low}` : null,
      out != null ? `zerados ${out}` : null,
    ].filter(Boolean);
    return bits.join(' · ');
  }
  if (id === 'recon') {
    const n = finiteCount(snap.openRecon);
    return n == null ? null : `${n} aberta(s)`;
  }
  return null;
}

/** Display a snapshot count. Missing or not-ready → em dash, including never substituting 0. */
export function opsCountOrDash(value: number | null | undefined, ready: boolean): string {
  if (!ready) return '—';
  const n = finiteCount(value);
  return n == null ? '—' : n;
}

function finiteOrNull(value: number | null | undefined): number | null {
  const n = finiteCount(value);
  return n == null ? null : Math.trunc(Number(n));
}

/** Pedidos command copy — counts still come only from the snapshot. */
export const PEDIDOS_NOW_LEDE =
  'Fila e pagos travados deste GET /admin/ops. Zero continua zero. Sem snapshot, o valor fica —.';

export const PEDIDOS_DO_LEDE =
  'Filtros e buckets que já existem nesta fila. Nenhum deles estorna, cria status ou resolve sozinho.';

/** Catálogo command copy — stock and photos already on the ops payload. */
export const CATALOGO_NOW_LEDE =
  'Estoque e fotos deste GET /admin/ops. Zero continua zero. Sem snapshot, o valor fica —.';

export const CATALOGO_DO_LEDE =
  'Atalhos para o painel de estoque, a fila de fotos e o CSV que já existem. Nada grava sozinho.';

/**
 * Pedidos attention = critical queue alerts already emitted by GET /admin/ops.
 * Info rows (aguardando pagamento, histórico terminal) stay as signals.
 */
const PEDIDOS_ATTENTION_CODES = new Set([
  'paid_stuck_awaiting_org',
  'paid_needs_organizing',
  'order_problems',
  'pending_payments',
  'store_notify_mail_failed',
  'mail_off_with_store_notify',
]);

const PEDIDOS_SIGNAL_CODES = new Set(['awaiting_payment_orders', 'order_terminal_history']);

/** Catálogo attention includes the info photo alert — the API already emits it. */
const CATALOGO_ATTENTION_CODES = new Set(['out_of_stock', 'low_stock', 'placeholder_photos']);

export type AdminCommandSection = 'pedidos' | 'catalogo';

export function partitionSectionAlerts<T extends OpsAlertLike>(
  alerts: T[] | null | undefined,
  section: AdminCommandSection,
): { attention: T[]; signals: T[] } {
  const list = alerts ?? [];
  if (section === 'pedidos') {
    return {
      attention: sortOpsAlertsForAttention(
        list.filter((a) => PEDIDOS_ATTENTION_CODES.has(a.code) && String(a.severity) !== 'info'),
      ),
      signals: sortOpsAlertsForAttention(
        list.filter(
          (a) =>
            PEDIDOS_SIGNAL_CODES.has(a.code) ||
            (PEDIDOS_ATTENTION_CODES.has(a.code) && String(a.severity) === 'info'),
        ),
      ),
    };
  }
  return {
    attention: sortOpsAlertsForAttention(list.filter((a) => CATALOGO_ATTENTION_CODES.has(a.code))),
    signals: [],
  };
}

export type PedidosCommandCounts = {
  ready: boolean;
  total: number | null;
  paidAwaiting: number | null;
  stuckPaid: number | null;
  stuckHoursThreshold: number | null;
  oldestStuckHours: number | null;
  stuckPublicIds: string[];
  legacyStuck: number | null;
  awaitingPayment: number | null;
  /** Null when the snapshot omitted `orders.buckets` — never a guessed zero map. */
  buckets: Record<string, number> | null;
};

const BLANK_PEDIDOS_COUNTS: PedidosCommandCounts = {
  ready: false,
  total: null,
  paidAwaiting: null,
  stuckPaid: null,
  stuckHoursThreshold: null,
  oldestStuckHours: null,
  stuckPublicIds: [],
  legacyStuck: null,
  awaitingPayment: null,
  buckets: null,
};

export function pedidosCommandCounts(
  ops: {
    orders?: {
      total?: number | null;
      stuckCount?: number | null;
      buckets?: Record<string, number | null | undefined> | null;
    } | null;
    paidAwaitingOrg?: {
      paidAwaitingCount?: number | null;
      stuckCount?: number | null;
      stuckHoursThreshold?: number | null;
      oldestStuckHours?: number | null;
      stuckPublicIds?: string[] | null;
    } | null;
  } | null | undefined,
  ready: boolean,
): PedidosCommandCounts {
  if (!ready || !ops) return { ...BLANK_PEDIDOS_COUNTS };
  const bucketsRaw = ops.orders?.buckets;
  let buckets: Record<string, number> | null = null;
  if (bucketsRaw && typeof bucketsRaw === 'object') {
    buckets = {};
    for (const [key, value] of Object.entries(bucketsRaw)) {
      const n = finiteOrNull(value);
      if (n != null) buckets[key] = n;
    }
  }
  const paidDirect = finiteOrNull(ops.paidAwaitingOrg?.paidAwaitingCount);
  return {
    ready: true,
    total: finiteOrNull(ops.orders?.total),
    paidAwaiting: paidDirect ?? finiteOrNull(buckets?.paid),
    stuckPaid: finiteOrNull(ops.paidAwaitingOrg?.stuckCount),
    stuckHoursThreshold: finiteOrNull(ops.paidAwaitingOrg?.stuckHoursThreshold),
    oldestStuckHours: finiteOrNull(ops.paidAwaitingOrg?.oldestStuckHours),
    stuckPublicIds: (ops.paidAwaitingOrg?.stuckPublicIds ?? []).map((id) => String(id)).filter(Boolean),
    legacyStuck: finiteOrNull(ops.orders?.stuckCount),
    awaitingPayment: buckets ? (finiteOrNull(buckets.awaiting_payment) ?? null) : null,
    buckets,
  };
}

export function pedidosNowSummary(
  counts: PedidosCommandCounts,
  snapshot: 'pending' | 'ready' | 'error',
): string {
  if (!counts.ready) {
    return snapshot === 'error'
      ? 'Snapshot operacional indisponível. Nenhum número foi estimado.'
      : 'Lendo o snapshot…';
  }
  const bits: string[] = [];
  if (counts.paidAwaiting != null) {
    bits.push(`${counts.paidAwaiting} pago(s) aguardando organização.`);
  }
  if (counts.stuckPaid != null) bits.push(`${counts.stuckPaid} pago(s) travado(s).`);
  if (counts.legacyStuck != null) bits.push(`${counts.legacyStuck} legado(s) em separando/saiu.`);
  if (!bits.length) return 'O snapshot não trouxe contagens de fila.';
  return bits.join(' ');
}

export const PEDIDOS_QUICK_ACTIONS = [
  { id: 'paid', label: 'Organizar pagos', hint: 'Filtra o bucket Pago nesta fila' },
  { id: 'stuck', label: 'Pagos travados', hint: 'Filtro ROI de pagos acima do limite' },
  { id: 'problems', label: 'Bucket problemas', hint: 'Legado travado e histórico já mapeados' },
  { id: 'awaiting', label: 'Aguardando pagamento', hint: 'Filtra o bucket existente' },
  { id: 'no_shipping', label: 'Sem frete ou rastreio', hint: 'Filtro ROI da fila carregada' },
] as const;

export type PedidosQuickActionId = (typeof PEDIDOS_QUICK_ACTIONS)[number]['id'];

/** Live figure for a Pedidos shortcut. Null when that field was not on the snapshot. */
export function pedidosQuickActionFigure(
  id: PedidosQuickActionId,
  counts: PedidosCommandCounts,
): string | null {
  if (!counts.ready) return null;
  if (id === 'paid') return counts.paidAwaiting == null ? null : `${counts.paidAwaiting} no snapshot`;
  if (id === 'stuck') return counts.stuckPaid == null ? null : `${counts.stuckPaid} no snapshot`;
  if (id === 'problems') {
    const bucket = counts.buckets ? finiteOrNull(counts.buckets.problems) : null;
    return bucket == null ? null : `${bucket} no snapshot`;
  }
  if (id === 'awaiting') {
    return counts.awaitingPayment == null ? null : `${counts.awaitingPayment} no snapshot`;
  }
  return null;
}

export type CatalogoCommandCounts = {
  ready: boolean;
  lowStock: number | null;
  outOfStock: number | null;
  lowStockThreshold: number | null;
  placeholderPhotos: number | null;
};

const BLANK_CATALOGO_COUNTS: CatalogoCommandCounts = {
  ready: false,
  lowStock: null,
  outOfStock: null,
  lowStockThreshold: null,
  placeholderPhotos: null,
};

export function catalogoCommandCounts(
  ops: {
    inventory?: {
      lowStockCount?: number | null;
      outOfStockCount?: number | null;
      lowStockThreshold?: number | null;
    } | null;
    catalog?: { placeholderProductCount?: number | null } | null;
  } | null | undefined,
  ready: boolean,
): CatalogoCommandCounts {
  if (!ready || !ops) return { ...BLANK_CATALOGO_COUNTS };
  return {
    ready: true,
    lowStock: finiteOrNull(ops.inventory?.lowStockCount),
    outOfStock: finiteOrNull(ops.inventory?.outOfStockCount),
    lowStockThreshold: finiteOrNull(ops.inventory?.lowStockThreshold),
    placeholderPhotos: finiteOrNull(ops.catalog?.placeholderProductCount),
  };
}

export function catalogoNowSummary(
  counts: CatalogoCommandCounts,
  snapshot: 'pending' | 'ready' | 'error',
): string {
  if (!counts.ready) {
    return snapshot === 'error'
      ? 'Snapshot operacional indisponível. Nenhum número foi estimado.'
      : 'Lendo o snapshot…';
  }
  const bits: string[] = [];
  if (counts.lowStock != null) bits.push(`${counts.lowStock} com estoque baixo.`);
  if (counts.outOfStock != null) bits.push(`${counts.outOfStock} zerado(s).`);
  if (counts.placeholderPhotos != null) {
    bits.push(`${counts.placeholderPhotos} com foto placeholder ou ausente.`);
  }
  if (!bits.length) return 'O snapshot não trouxe estoque nem fotos.';
  return bits.join(' ');
}

export const CATALOGO_QUICK_ACTIONS = [
  { id: 'stock', label: 'Abrir estoque', hint: 'Rola até o painel de estoque baixo' },
  { id: 'photos', label: 'Trocar fotos', hint: 'Abre a fila sem foto / placeholder' },
  { id: 'csv', label: 'Baixar CSV', hint: 'GET /admin/ops/products-needing-photos' },
  { id: 'form', label: 'Cadastrar produto', hint: 'Abre o formulário que já existe' },
] as const;

export type CatalogoQuickActionId = (typeof CATALOGO_QUICK_ACTIONS)[number]['id'];

export function catalogoQuickActionFigure(
  id: CatalogoQuickActionId,
  counts: CatalogoCommandCounts,
): string | null {
  if (!counts.ready) return null;
  if (id === 'stock') {
    if (counts.lowStock == null && counts.outOfStock == null) return null;
    const bits = [
      counts.lowStock != null ? `baixo ${counts.lowStock}` : null,
      counts.outOfStock != null ? `zerados ${counts.outOfStock}` : null,
    ].filter(Boolean);
    return bits.join(' · ');
  }
  if (id === 'photos') {
    return counts.placeholderPhotos == null ? null : `${counts.placeholderPhotos} no snapshot`;
  }
  return null;
}

/**
 * Loaded list vs snapshot. Null until the snapshot count exists —
 * does not treat a missing field as zero.
 */
export function snapshotListAlignmentNote(
  snapshotCount: number | null | undefined,
  listCount: number,
  ready: boolean,
): string | null {
  if (!ready) return null;
  const snap = finiteOrNull(snapshotCount);
  if (snap == null) return null;
  const list = Math.max(0, Math.trunc(Number(listCount) || 0));
  if (snap === list) return `Lista carregada: ${list} · igual ao snapshot.`;
  return `Lista carregada: ${list} · snapshot: ${snap}. A lista é o que esta tela já leu; o snapshot é GET /admin/ops.`;
}

export function formatOpsSnapshotTime(iso?: string | null): string {
  const raw = String(iso || '').trim();
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
}

export type OpsMailStatusInput = {
  configured?: boolean;
  providerOffWithStoreNotify?: boolean;
  storeNotifyFailureCount?: number | null;
};

export function opsMailStatusLabel(
  mail: OpsMailStatusInput | null | undefined,
  ready: boolean,
): { label: string; tone: 'ok' | 'danger' | 'muted' } {
  if (!ready || mail == null) return { label: '—', tone: 'muted' };
  const failures = Math.max(0, Math.floor(Number(mail.storeNotifyFailureCount) || 0));
  if (failures > 0) return { label: `${failures} falha(s)`, tone: 'danger' };
  if (mail.providerOffWithStoreNotify) return { label: 'Provedor off', tone: 'danger' };
  if (mail.configured) return { label: 'Configurado', tone: 'ok' };
  return { label: 'Ausente', tone: 'danger' };
}

/** Uploads durability is omitted from the payload when unknown — do not invent a status. */
export function opsUploadsStatusLabel(
  uploads: { persistent?: boolean; dir?: string | null } | null | undefined,
): string | null {
  if (!uploads || typeof uploads.persistent !== 'boolean') return null;
  const dir = uploads.dir ? ` · ${uploads.dir}` : '';
  return uploads.persistent ? `Volume persistente${dir}` : `Disco efêmero${dir}`;
}

/**
 * Empty attention copy. `infoCount` is the number of info-level alerts
 * already present on the snapshot (not estimated).
 */
export function opsAttentionEmptyMessage(infoCount = 0): string {
  const extra = Math.max(0, Math.floor(Number(infoCount) || 0));
  if (extra > 0) {
    return 'Nenhum alerta crítico, urgente ou de atenção neste snapshot. Sinais informativos continuam na lista abaixo.';
  }
  return 'Nada precisa de atenção neste snapshot.';
}

/** Shown when GET /admin/ops did not return — never fill with invented counts. */
export function opsAttentionUnavailableMessage(): string {
  return 'Snapshot operacional indisponível. Nenhum número foi estimado — atualize para ler GET /admin/ops.';
}

/** PT severity chip for ATENÇÃO AGORA — never leave English "high"/"warn". */
export function opsAlertSeverityLabelPt(sev: OpsAlertSeverityLike): string {
  const s = String(sev || '').toLowerCase();
  if (s === 'critical') return 'CRÍTICO';
  if (s === 'high') return 'URGENTE';
  if (s === 'warn') return 'ATENÇÃO';
  if (s === 'info') return 'INFO';
  return s ? s.toUpperCase() : 'INFO';
}

export type OpsAlertLike = {
  code: string;
  severity: OpsAlertSeverityLike;
  section?: string | null;
  queueBucket?: string | null;
  evidenceIds?: string[] | null;
};

export type OpsAlertDestination =
  | { kind: 'reconciliations' }
  | { kind: 'mail'; publicId: string | null }
  | { kind: 'catalog_photos' }
  | { kind: 'catalog' }
  | { kind: 'orders'; bucket: string }
  | { kind: 'none' };

/**
 * Existing console path for an ops alert. Stock opens Catálogo (painel de estoque).
 * Alerts with no in-app section stay `none` — no invented screen.
 */
export function opsAlertDestination(a: OpsAlertLike): OpsAlertDestination {
  if (a.section === 'reconciliations' || a.code === 'open_reconciliations') {
    return { kind: 'reconciliations' };
  }
  if (
    a.section === 'mail' ||
    a.code === 'store_notify_mail_failed' ||
    a.code === 'mail_off_with_store_notify'
  ) {
    const publicId = String(a.evidenceIds?.[0] || '').trim();
    return { kind: 'mail', publicId: publicId || null };
  }
  if (a.section === 'catalog' || a.code === 'placeholder_photos') {
    return { kind: 'catalog_photos' };
  }
  if (a.code === 'out_of_stock' || a.code === 'low_stock' || a.section === 'inventory') {
    return { kind: 'catalog' };
  }
  if (a.queueBucket) return { kind: 'orders', bucket: String(a.queueBucket) };
  return { kind: 'none' };
}

/**
 * Recon + store-mail first so they survive the ATENÇÃO AGORA cap.
 * Matches API sortOpsAlertsForAttention.
 */
export function sortOpsAlertsForAttention<T extends OpsAlertLike>(alerts: T[]): T[] {
  const rankCode = (code: string): number => {
    if (code === 'open_reconciliations') return 0;
    if (code === 'store_notify_mail_failed') return 1;
    if (code === 'mail_off_with_store_notify') return 2;
    return 10;
  };
  const rankSev = (sev: OpsAlertSeverityLike): number => {
    const s = String(sev || '');
    if (s === 'critical') return 0;
    if (s === 'high') return 1;
    if (s === 'warn') return 2;
    return 3;
  };
  return [...alerts].sort((a, b) => {
    const c = rankCode(a.code) - rankCode(b.code);
    if (c !== 0) return c;
    return rankSev(a.severity) - rankSev(b.severity);
  });
}

export function opsAlertCtaHintPt(a: OpsAlertLike): string | null {
  const dest = opsAlertDestination(a);
  if (dest.kind === 'reconciliations') return '→ abrir fila Reconciliações';
  if (dest.kind === 'mail') return '→ Pedidos / reenviar aviso';
  if (dest.kind === 'catalog_photos') return '→ Catálogo (fotos)';
  if (dest.kind === 'catalog') return '→ Catálogo (estoque)';
  if (dest.kind === 'orders') return '→ abrir fila';
  return null;
}

export type StorePaidNotifyResult = {
  publicId?: string | null;
  emailsAttempted?: number | null;
  emailsSent?: number | null;
  inAppCreated?: number | null;
  mailOutcome?: string | null;
  mailReason?: string | null;
};

/**
 * Admin copy after POST /admin/orders/:id/notify-paid.
 * Distinguishes send failure vs never attempted vs sent vs duplicate.
 */
export function storePaidNotifyResultMessage(data: StorePaidNotifyResult): string {
  const publicId = String(data.publicId || '').trim() || 'pedido';
  const attempted = Math.max(0, Math.floor(Number(data.emailsAttempted) || 0));
  const sent =
    data.emailsSent == null
      ? null
      : Math.max(0, Math.floor(Number(data.emailsSent) || 0));
  const inApp = Math.max(0, Math.floor(Number(data.inAppCreated) || 0));
  const outcome = String(data.mailOutcome || '').trim();
  const inAppBit = `In-app loja: ${inApp}.`;

  if (outcome === 'sent' || (sent != null && sent > 0)) {
    const n = sent ?? attempted;
    return `Aviso da loja enviado (${publicId}): ${n} e-mail(s) enviado(s). ${inAppBit}`;
  }
  if (outcome === 'duplicate_skipped' || data.mailReason === 'duplicate') {
    return `E-mail da loja já enviado recentemente (${publicId}) — não reenviado (dedupe). ${inAppBit} Não é falha.`;
  }
  if (outcome === 'no_recipients' || (outcome === '' && attempted === 0 && sent !== null && sent === 0)) {
    return `Aviso da loja NÃO tentado por e-mail (${publicId}): nenhum destinatário. ${inAppBit} Confira STORE_NOTIFY_EMAIL / admins ativos.`;
  }
  if (outcome === 'provider_off' || data.mailReason === 'smtp_not_configured') {
    return `Aviso da loja NÃO enviado por e-mail (${publicId}): provedor desligado (não chegou a falhar o envio). ${inAppBit} Configure MAIL_FROM + RESEND_API_KEY.`;
  }
  if (outcome === 'send_failed' || outcome === 'error') {
    return `Envio de e-mail da loja FALHOU (${publicId}): tentados ${attempted}, enviados ${sent ?? 0}. ${inAppBit} Pagamento não foi revertido. Use Reenviar de novo se o provedor já estiver ok.`;
  }
  // Legacy payload: only emailsAttempted + inAppCreated
  if (attempted === 0) {
    return `Aviso da loja NÃO tentado por e-mail (${publicId}): 0 destinatários (nunca tentou). ${inAppBit} Confira STORE_NOTIFY_EMAIL / MAIL_FROM.`;
  }
  return `Aviso loja reenviado (${publicId}): e-mails tentados ${attempted}, in-app ${inApp}. Se a caixa não recebeu, o envio pode ter falhado — confira o alerta no Centro de comando.`;
}

/** Per-order hint when GET /admin/ops last failure matches this publicId. */
export function storePaidNotifyCardHint(opts: {
  orderPublicId: string;
  lastFailure?: { publicId?: string | null; event?: string | null; reason?: string | null } | null;
}): string | null {
  const id = String(opts.orderPublicId || '').trim();
  const failId = String(opts.lastFailure?.publicId || '').trim();
  if (!id || !failId || id !== failId) return null;
  const event = String(opts.lastFailure?.event || '');
  const reason = String(opts.lastFailure?.reason || '');
  if (event === 'STORE_EMAIL_NO_RECIPIENTS' || reason === 'no_recipients') {
    return 'E-mail da loja deste pedido NÃO foi tentado (nenhum destinatário). Reenviar depois de conferir STORE_NOTIFY_EMAIL.';
  }
  if (
    event === 'MAIL_PROVIDER_OFF_STORE_NOTIFY' ||
    event === 'MAIL_PROVIDER_OFF' ||
    reason === 'smtp_not_configured'
  ) {
    return 'E-mail da loja deste pedido NÃO foi enviado — provedor desligado (não chegou a falhar o transporte).';
  }
  return 'E-mail da loja deste pedido FALHOU no último envio. Reenviar aviso loja — pagamento permanece pago.';
}
