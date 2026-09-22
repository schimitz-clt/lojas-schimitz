/**
 * Pedidos + Catálogo enterprise — view models for evidence already on the APIs.
 * No network. Missing field → "—". Zero stays zero. No invented KPI.
 */

import { brl } from './api';
import { batchSelectionError } from './catalog-import-ui';
import { formatAdminDateTime } from './admin-customers-ui';
import { nextFulfillmentStatus, orderStatusLabel } from './order-status';

export const ENTERPRISE_MISSING = '—';

/** actorId is the only "who" the order history payload carries. No new RBAC. */
export const ORDER_ACTOR_SCOPE =
  'Quem fez: o histórico mostra actorId quando a API gravou. O nome da pessoa não vem neste payload.';

export const CATALOG_BATCH_PHOTO_NOTE =
  'Foto não entra neste lote: cada produto usa Enviar foto ou a galeria. Preço em lote continua em Importação / Lote, no mesmo POST /admin/products/batch.';

export type EnterpriseField = { label: string; value: string };

export type EnterpriseAddressSnap = {
  label?: string | null;
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  uf?: string | null;
  phone?: string | null;
};

export type EnterpriseOrderInput = {
  publicId?: string | null;
  status?: string | null;
  subtotal?: number | string | null;
  discount?: number | string | null;
  cashbackUsed?: number | string | null;
  freight?: number | string | null;
  total?: number | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  reservationExpiresAt?: string | null;
  trackingCode?: string | null;
  carrier?: string | null;
  user?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  addressSnap?: EnterpriseAddressSnap | null;
  freightSnap?: {
    label?: string | null;
    fee?: number | null;
    price?: number | null;
    estimatedDays?: number | null;
    days?: number | null;
    carrier?: string | null;
  } | null;
  items?: Array<{
    name?: string | null;
    qty?: number | null;
    unitPrice?: number | string | null;
    imageUrl?: string | null;
  }> | null;
  payments?: Array<{
    status?: string | null;
    method?: string | null;
    provider?: string | null;
    externalId?: string | null;
    amount?: number | string | null;
    createdAt?: string | null;
  }> | null;
  statusHistory?: Array<{
    fromStatus?: string | null;
    toStatus?: string | null;
    note?: string | null;
    createdAt?: string | null;
    actorId?: string | null;
  }> | null;
};

export function textOrDash(value: unknown): string {
  if (value == null) return ENTERPRISE_MISSING;
  const s = String(value).trim();
  return s.length ? s : ENTERPRISE_MISSING;
}

export function countOrDash(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return value.trim();
  return ENTERPRISE_MISSING;
}

function moneyNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Currency from the API. Null/blank → dash. 0 stays R$ 0,00. */
export function moneyOrDash(value: unknown): string {
  const n = moneyNumber(value);
  if (n == null) return ENTERPRISE_MISSING;
  return brl(n);
}

export function formatOrderAddress(snap?: EnterpriseAddressSnap | null): string {
  if (!snap) return ENTERPRISE_MISSING;
  const street = [snap.street, snap.number]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(', ');
  const cityUf = [snap.city, snap.uf]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join('/');
  const cep = (snap.cep || '').trim();
  const parts = [snap.label, street, snap.complement, snap.district, cityUf, cep ? `CEP ${cep}` : '']
    .map((part) => (part || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : ENTERPRISE_MISSING;
}

export type OrderItemLine = {
  name: string;
  qty: string;
  unit: string;
  line: string;
  imageUrl: string;
};

export function orderItemLines(items?: EnterpriseOrderInput['items']): OrderItemLine[] {
  if (!items?.length) return [];
  return items.map((item) => {
    const qty = typeof item.qty === 'number' && Number.isFinite(item.qty) ? item.qty : null;
    const unit = moneyNumber(item.unitPrice);
    const line = qty != null && unit != null ? brl(Math.round(qty * unit * 100) / 100) : ENTERPRISE_MISSING;
    return {
      name: textOrDash(item.name),
      qty: qty == null ? ENTERPRISE_MISSING : String(qty),
      unit: unit == null ? ENTERPRISE_MISSING : brl(unit),
      line,
      imageUrl: (item.imageUrl || '').trim(),
    };
  });
}

function paymentLabel(method?: string | null): string {
  const raw = (method || '').trim();
  if (!raw) return ENTERPRISE_MISSING;
  const kind = raw.toLowerCase();
  if (kind === 'pix') return 'PIX';
  if (kind === 'card' || kind === 'credit_card' || kind === 'debit_card' || kind.includes('card')) {
    return 'Cartão';
  }
  return raw;
}

export function orderPaymentLines(payments?: EnterpriseOrderInput['payments']): string[] {
  if (!payments?.length) return [];
  return payments.map((payment) => {
    const method = paymentLabel(payment.method);
    const ext = (payment.externalId || '').trim();
    return [
      textOrDash(payment.status),
      method,
      textOrDash(payment.provider),
      moneyOrDash(payment.amount),
      payment.createdAt ? formatAdminDateTime(payment.createdAt) : ENTERPRISE_MISSING,
      ext ? `ext ${ext}` : `ext ${ENTERPRISE_MISSING}`,
    ].join(' · ');
  });
}

export type OrderHistoryLine = {
  when: string;
  from: string;
  to: string;
  note: string;
  actor: string;
};

export function historyActorLabel(actorId?: string | null): string {
  return textOrDash(actorId);
}

export function orderHistoryLines(history?: EnterpriseOrderInput['statusHistory']): OrderHistoryLine[] {
  if (!history?.length) return [];
  return history.map((row) => ({
    when: formatAdminDateTime(row.createdAt),
    from: row.fromStatus ? orderStatusLabel(row.fromStatus) : ENTERPRISE_MISSING,
    to: row.toStatus ? orderStatusLabel(row.toStatus) : ENTERPRISE_MISSING,
    note: textOrDash(row.note),
    actor: historyActorLabel(row.actorId),
  }));
}

function freightDays(snap: EnterpriseOrderInput['freightSnap']): string {
  const days = snap?.estimatedDays ?? snap?.days;
  if (typeof days === 'number' && Number.isFinite(days)) return String(days);
  return ENTERPRISE_MISSING;
}

export type OrderDossierModel = {
  publicId: string;
  statusLabel: string;
  nextLabel: string;
  nextStatus: string | null;
  needsTracking: boolean;
  createdAt: string;
  updatedAt: string;
  reservationExpiresAt: string;
  totals: EnterpriseField[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  freightLabel: string;
  freightDays: string;
  carrier: string;
  tracking: string;
  items: OrderItemLine[];
  payments: string[];
  history: OrderHistoryLine[];
};

export function orderDossierModel(order: EnterpriseOrderInput): OrderDossierModel {
  const status = (order.status || '').trim();
  const next = status ? nextFulfillmentStatus(status) : null;
  return {
    publicId: textOrDash(order.publicId),
    statusLabel: status ? `${orderStatusLabel(status)} (${status})` : ENTERPRISE_MISSING,
    nextLabel: next ? `${orderStatusLabel(next)} (${next})` : ENTERPRISE_MISSING,
    nextStatus: next,
    needsTracking: next === 'in_transit',
    createdAt: formatAdminDateTime(order.createdAt),
    updatedAt: formatAdminDateTime(order.updatedAt),
    reservationExpiresAt: formatAdminDateTime(order.reservationExpiresAt),
    totals: [
      { label: 'Subtotal', value: moneyOrDash(order.subtotal) },
      { label: 'Desconto', value: moneyOrDash(order.discount) },
      { label: 'Cashback usado', value: moneyOrDash(order.cashbackUsed) },
      { label: 'Frete', value: moneyOrDash(order.freight) },
      { label: 'Total', value: moneyOrDash(order.total) },
    ],
    customerName: textOrDash(order.user?.name),
    customerEmail: textOrDash(order.user?.email),
    customerPhone: textOrDash(order.user?.phone || order.addressSnap?.phone),
    address: formatOrderAddress(order.addressSnap),
    freightLabel: textOrDash(order.freightSnap?.label),
    freightDays: freightDays(order.freightSnap),
    carrier: textOrDash(order.carrier || order.freightSnap?.carrier),
    tracking: textOrDash(order.trackingCode),
    items: orderItemLines(order.items),
    payments: orderPaymentLines(order.payments),
    history: orderHistoryLines(order.statusHistory),
  };
}

export function fulfillmentConfirmCopy(input: {
  publicId: string;
  fromStatus: string;
  toStatus: string;
}): { title: string; detail: string } {
  const from = orderStatusLabel(input.fromStatus);
  const to = orderStatusLabel(input.toStatus);
  const needsTracking = nextFulfillmentStatus(input.fromStatus) === 'in_transit';
  return {
    title: `Confirmar ${input.publicId}: ${from} → ${to}?`,
    detail: needsTracking
      ? 'PATCH /admin/orders/:id/status. Rastreio é opcional e, se preenchido, aparece para o cliente. Sem cobrança e sem estorno.'
      : 'PATCH /admin/orders/:id/status com o próximo status que o backend já aceita neste pedido. Sem cobrança e sem estorno.',
  };
}

export function orderMutationErrorText(message: unknown): string {
  const text = typeof message === 'string' ? message.trim() : '';
  return text || 'A API não confirmou a atualização de status.';
}

export type CatalogBatchProduct = {
  id: string;
  sku?: string | null;
  name?: string | null;
};

export function partitionCatalogBatch<T extends CatalogBatchProduct>(
  products: readonly T[],
  selectedIds: readonly string[],
): { skus: string[]; missingSku: Array<{ id: string; name: string }> } {
  const selected = new Set(selectedIds);
  const skus: string[] = [];
  const seen = new Set<string>();
  const missingSku: Array<{ id: string; name: string }> = [];
  for (const product of products) {
    if (!selected.has(product.id)) continue;
    const sku = (product.sku || '').trim();
    if (sku.length < 2) {
      missingSku.push({ id: product.id, name: textOrDash(product.name) });
      continue;
    }
    if (seen.has(sku)) continue;
    seen.add(sku);
    skus.push(sku);
  }
  return { skus, missingSku };
}

export function catalogBatchRequestError(part: { skus: string[]; missingSku: unknown[] }): string | null {
  if (!part.skus.length && part.missingSku.length) {
    return 'Os marcados não têm SKU neste payload. O lote usa POST /admin/products/batch por SKU. Nada foi enviado.';
  }
  return batchSelectionError(part.skus.length);
}

export function catalogBatchSkipNote(missing: Array<{ name: string }>): string {
  if (!missing.length) return '';
  const names = missing
    .slice(0, 5)
    .map((row) => row.name)
    .join(', ');
  const extra = missing.length > 5 ? ` e mais ${missing.length - 5}` : '';
  return `Sem SKU, fora do lote: ${names}${extra}.`;
}

export type CatalogStockBatchBody = {
  skus: string[];
  stockMode: 'set' | 'delta';
  stockValue: number;
};

export function catalogStockBatchBody(
  skus: string[],
  mode: 'set' | 'delta',
  raw: string,
): { ok: true; body: CatalogStockBatchBody } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return { ok: false, error: 'Estoque do lote precisa ser um inteiro. Nada foi enviado.' };
  }
  const value = Number(trimmed);
  if (mode === 'set' && value < 0) {
    return { ok: false, error: 'Estoque definido não pode ser negativo. Nada foi enviado.' };
  }
  if (mode === 'delta' && value === 0) {
    return { ok: false, error: 'Ajuste zero não muda o estoque. Nada foi enviado.' };
  }
  return { ok: true, body: { skus, stockMode: mode, stockValue: value } };
}

export function catalogActiveBatchBody(skus: string[], active: boolean): { skus: string[]; active: boolean } {
  return { skus, active };
}

export function catalogBatchConfirmText(
  kind: 'stock-set' | 'stock-delta' | 'activate' | 'deactivate',
  count: number,
  value?: string,
): string {
  if (kind === 'stock-set') {
    return `Definir estoque ${value} em ${count} SKU(s)? POST /admin/products/batch. O restante do catálogo não muda. Nada é apagado.`;
  }
  if (kind === 'stock-delta') {
    return `Ajustar estoque em ${value} (soma) em ${count} SKU(s)? POST /admin/products/batch. Nada é apagado.`;
  }
  if (kind === 'activate') {
    return `Ativar ${count} SKU(s) na vitrine? POST /admin/products/batch. Nada é apagado.`;
  }
  return `Desativar ${count} SKU(s) na vitrine? POST /admin/products/batch. O cadastro permanece. Nada é apagado.`;
}

export function catalogBatchProgressLabel(count: number): string {
  return `Aplicando lote em ${count} SKU(s)…`;
}

export type CatalogBatchReport = {
  updated?: number | null;
  failed?: number | null;
  deleted?: number | null;
  errors?: Array<{ sku?: string | null; message?: string | null }> | null;
  errorsTruncated?: boolean;
};

export function catalogBatchFeedback(report: CatalogBatchReport): { summary: string; lines: string[] } {
  const summary = `Atualizados: ${countOrDash(report.updated)} · Falhas: ${countOrDash(report.failed)} · Apagados: ${countOrDash(report.deleted)}.`;
  const lines = (report.errors || []).map((row) => {
    const sku = (row.sku || '').trim() || 'SKU —';
    const message = (row.message || '').trim() || 'A API não detalhou o erro.';
    return `${sku}: ${message}`;
  });
  if (report.errorsTruncated) lines.push('A API truncou a lista de erros.');
  return { summary, lines };
}
