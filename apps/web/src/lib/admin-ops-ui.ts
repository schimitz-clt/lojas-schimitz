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

export type StorePaidNotifyResendResult = {
  publicId: string;
  inAppCreated: number;
  emailsAttempted: number;
  emailsSent?: number;
  emailsFailed?: number;
  mailOutcome?: 'sent' | 'provider_off' | 'no_recipients' | 'send_failed' | 'partial' | string;
  mailConfigured?: boolean;
};

/** Distinguishes mail failed vs never attempted after POST notify-paid. */
export function storePaidNotifyResendMessage(data: StorePaidNotifyResendResult): string {
  const pid = data.publicId || 'pedido';
  const inApp = Number(data.inAppCreated) || 0;
  switch (data.mailOutcome) {
    case 'provider_off':
      return `Pedido ${pid} pago, mas o e-mail da loja NÃO foi tentado: provedor desligado (MAIL_FROM + RESEND_API_KEY/SMTP). In-app: ${inApp}. Pagamento não foi revertido.`;
    case 'no_recipients':
      return `Pedido ${pid} pago, mas o e-mail da loja NÃO foi tentado: nenhum destinatário (STORE_NOTIFY_EMAIL / admins). In-app: ${inApp}.`;
    case 'send_failed':
      return `Pedido ${pid} pago, mas o e-mail da loja FALHOU ao enviar (${data.emailsFailed ?? data.emailsAttempted} tentativa(s)). In-app: ${inApp}. Use Reenviar aviso loja de novo.`;
    case 'partial':
      return `Pedido ${pid}: e-mail da loja parcial (enviados ${data.emailsSent ?? 0}, falhas ${data.emailsFailed ?? 0}). In-app: ${inApp}.`;
    case 'sent':
      return `Aviso da loja reenviado (${pid}): e-mail enviado (${data.emailsSent ?? data.emailsAttempted}), in-app ${inApp}.`;
    default:
      if (!data.emailsAttempted) {
        return `Aviso loja: e-mail NÃO tentado (${pid}), in-app ${inApp}. Confira MAIL_FROM / STORE_NOTIFY_EMAIL — falhou vs nunca tentado.`;
      }
      return `Aviso loja reenviado (${pid}): e-mails tentados ${data.emailsAttempted}, in-app ${inApp}. Confira STORE_NOTIFY_EMAIL / MAIL_FROM se zero enviado.`;
  }
}

export type StoreNotifyMailFailureLike = {
  code?: string;
  publicId?: string;
  reason?: string;
};

export function storeNotifyCardHint(opts: {
  statusLabel: string;
  publicId: string;
  mail?: {
    configured?: boolean;
    recipientCount?: number | null;
    recentFailures?: StoreNotifyMailFailureLike[];
  } | null;
}): string {
  const fail = (opts.mail?.recentFailures || []).find((f) => f.publicId === opts.publicId);
  if (fail?.code === 'STORE_EMAIL_SEND_FAILED') {
    return `E-mail da loja FALHOU neste pedido (${fail.reason || 'send_failed'}). Use Reenviar aviso loja — não cria cobrança.`;
  }
  if (fail?.code === 'STORE_EMAIL_NO_RECIPIENTS') {
    return `E-mail da loja NÃO foi tentado neste pedido: sem destinatários. Reenviar só gera in-app até haver STORE_NOTIFY_EMAIL.`;
  }
  if (
    fail?.code === 'MAIL_PROVIDER_OFF_STORE_NOTIFY' ||
    fail?.code === 'MAIL_PROVIDER_OFF'
  ) {
    return `E-mail da loja NÃO foi tentado neste pedido: provedor desligado. Reenviar cria in-app, mas não dispara e-mail.`;
  }
  if (opts.mail?.configured === false) {
    return `Pedido já pago (${opts.statusLabel}). E-mail transacional ausente — Reenviar aviso loja cria in-app, mas não dispara e-mail.`;
  }
  if (opts.mail?.recipientCount === 0) {
    return `Pedido já pago (${opts.statusLabel}). Nenhum destinatário de e-mail da loja — Reenviar só gera in-app.`;
  }
  return `Pedido já pago (${opts.statusLabel}) — reenviar aviso de venda à loja se o e-mail não chegou (falhou) ou não foi tentado.`;
}

export function opsAlertSeverityLabelPt(severity: string): string {
  if (severity === 'critical') return 'Crítico';
  if (severity === 'high') return 'Alto';
  if (severity === 'warn') return 'Atenção';
  if (severity === 'info') return 'Info';
  return severity;
}

export function opsAlertCodeLabelPt(code: string, apiLabel?: string | null): string {
  if (apiLabel && apiLabel.trim()) return apiLabel.trim();
  const map: Record<string, string> = {
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
  return map[code] || code;
}

export function reconciliationsKpiHint(openCount: number | null | undefined): string {
  const n = Math.max(0, Number(openCount) || 0);
  if (openCount == null) return 'aguardando snapshot';
  if (n > 0) return `${n} aberta(s) — revisar agora (sem estorno automático)`;
  return 'nenhuma aberta';
}

export function emptyReconciliationsMessage(opts: {
  openCount?: number | null;
  listed: number;
}): string {
  const open = Math.max(0, Number(opts.openCount) || 0);
  if (open > 0 && opts.listed === 0) {
    return `${open} pagamento(s) a conciliar no snapshot — atualize a lista. Não estornar automaticamente.`;
  }
  if (open > 0) {
    return `${open} pagamento(s) no provedor sem pedido local — revisão humana.`;
  }
  return 'Nenhuma reconciliação aberta.';
}

export function mailOpsKpiValue(mail?: {
  configured?: boolean;
  providerOffWithStoreNotify?: boolean;
  recipientCount?: number | null;
  failureCount?: number;
} | null): { value: string; danger: boolean; hint: string } {
  if (!mail) return { value: '—', danger: false, hint: 'aguardando snapshot' };
  const failures = Math.max(0, Number(mail.failureCount) || 0);
  if (failures > 0) {
    return {
      value: 'Falha recente',
      danger: true,
      hint: `${failures} evento(s) nesta instância da API (desde o restart)`,
    };
  }
  if (mail.providerOffWithStoreNotify) {
    return {
      value: 'Provider off',
      danger: true,
      hint: 'STORE_NOTIFY set, MAIL_FROM/RESEND ausentes',
    };
  }
  if (mail.configured === false) {
    return { value: 'Ausente', danger: true, hint: 'MAIL_FROM + RESEND_API_KEY|SMTP' };
  }
  if (mail.recipientCount === 0) {
    return {
      value: 'Sem destinatário',
      danger: true,
      hint: 'Defina STORE_NOTIFY_EMAIL (não noreply)',
    };
  }
  return {
    value: 'Configurado',
    danger: false,
    hint:
      mail.recipientCount != null
        ? `${mail.recipientCount} destinatário(s) (contagem, sem endereços)`
        : 'STORE_NOTIFY / MAIL_FROM presentes',
  };
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
