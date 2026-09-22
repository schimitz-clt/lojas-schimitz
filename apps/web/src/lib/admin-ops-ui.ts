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

/** Ops home question — copy only; counts come from the snapshot. */
export const OPS_ATTENTION_HEADING = 'O que precisa de atenção?';

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
};

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
  if (a.section === 'reconciliations' || a.code === 'open_reconciliations') {
    return '→ abrir fila Reconciliações';
  }
  if (a.section === 'mail' || a.code === 'store_notify_mail_failed' || a.code === 'mail_off_with_store_notify') {
    return '→ Pedidos / reenviar aviso';
  }
  if (a.section === 'catalog') return '→ Catálogo (fotos)';
  if (a.queueBucket) return '→ abrir fila';
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
