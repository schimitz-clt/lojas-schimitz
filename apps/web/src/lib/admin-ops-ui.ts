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
