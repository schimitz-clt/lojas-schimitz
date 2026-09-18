/**
 * Process-local observability for post-paid store e-mail (loja).
 * Real events only — empty when nothing failed since boot / last success.
 * Never includes recipient addresses or secrets. Lost on process restart (no invented KPI).
 */

export const STORE_NOTIFY_FAILURE_CAP = 10;

export type StoreNotifyMailOutcome =
  | 'sent'
  | 'send_failed'
  | 'provider_off'
  | 'no_recipients'
  | 'duplicate_skipped'
  | 'error';

export type StoreNotifyMailEvent =
  | 'STORE_EMAIL_SEND_FAILED'
  | 'STORE_EMAIL_NO_RECIPIENTS'
  | 'MAIL_PROVIDER_OFF_STORE_NOTIFY'
  | 'MAIL_PROVIDER_OFF';

export type StoreNotifyMailFailure = {
  at: string;
  publicId: string;
  orderId: string | null;
  event: StoreNotifyMailEvent;
  /** Machine reason: send_failed | smtp_not_configured | no_recipients | error */
  reason: string;
  mode: string | null;
};

export type StoreNotifyMailSnapshot = {
  last: StoreNotifyMailFailure | null;
  /** Unique publicIds still in the failure window (cleared on later success). */
  openCount: number;
  recent: StoreNotifyMailFailure[];
};

export type StoreNotifySendResultLike = {
  sent?: boolean;
  reason?: string | null;
  mode?: string | null;
};

export type StoreNotifyMailAttemptSummary = {
  emailsAttempted: number;
  emailsSent: number;
  mailOutcome: StoreNotifyMailOutcome;
  mailReason: string;
  event: StoreNotifyMailEvent | null;
};

let failures: StoreNotifyMailFailure[] = [];

function nowIso(at?: string | Date): string {
  if (!at) return new Date().toISOString();
  return at instanceof Date ? at.toISOString() : String(at);
}

/** Classify a store-notify mail attempt — pure, no secrets. */
export function summarizeStoreNotifyMailAttempt(input: {
  mailConfigured: boolean;
  storeNotifyConfigured?: boolean;
  recipientCount: number;
  results?: StoreNotifySendResultLike[];
  threw?: boolean;
}): StoreNotifyMailAttemptSummary {
  const results = input.results ?? [];
  const emailsAttempted = results.length;
  const emailsSent = results.filter((r) => r?.sent).length;
  const recipientCount = Math.max(0, Math.floor(Number(input.recipientCount) || 0));

  if (input.threw) {
    return {
      emailsAttempted,
      emailsSent,
      mailOutcome: 'error',
      mailReason: 'error',
      event: 'STORE_EMAIL_SEND_FAILED',
    };
  }

  if (recipientCount <= 0) {
    return {
      emailsAttempted: 0,
      emailsSent: 0,
      mailOutcome: 'no_recipients',
      mailReason: 'no_recipients',
      event: 'STORE_EMAIL_NO_RECIPIENTS',
    };
  }

  if (!input.mailConfigured) {
    return {
      emailsAttempted,
      emailsSent: 0,
      mailOutcome: 'provider_off',
      mailReason: 'smtp_not_configured',
      event: input.storeNotifyConfigured
        ? 'MAIL_PROVIDER_OFF_STORE_NOTIFY'
        : 'MAIL_PROVIDER_OFF',
    };
  }

  if (emailsSent > 0) {
    return {
      emailsAttempted,
      emailsSent,
      mailOutcome: 'sent',
      mailReason: 'sent',
      event: null,
    };
  }

  const reasons = results.map((r) => String(r?.reason || '')).filter(Boolean);
  const allDuplicate =
    results.length > 0 && results.every((r) => !r?.sent && r?.reason === 'duplicate');
  if (allDuplicate) {
    return {
      emailsAttempted,
      emailsSent: 0,
      mailOutcome: 'duplicate_skipped',
      mailReason: 'duplicate',
      event: null,
    };
  }

  const firstFail = reasons.find((r) => r && r !== 'duplicate') || 'send_failed';
  return {
    emailsAttempted,
    emailsSent: 0,
    mailOutcome: firstFail === 'smtp_not_configured' ? 'provider_off' : 'send_failed',
    mailReason: firstFail,
    event: 'STORE_EMAIL_SEND_FAILED',
  };
}

/** PT label for ops / Command Center — no env values, no e-mail addresses. */
export function storeNotifyFailureLabelPt(input: {
  event?: string | null;
  reason?: string | null;
  publicId?: string | null;
  count?: number;
}): string {
  const publicId = String(input.publicId || '').trim();
  const n = Math.max(1, Math.floor(Number(input.count) || 1));
  const pedido = publicId ? ` (pedido ${publicId})` : '';
  const extra =
    n > 1 ? ` · ${n} venda(s) paga(s) sem e-mail da loja neste processo` : '';
  const event = String(input.event || '');
  const reason = String(input.reason || '');

  if (event === 'STORE_EMAIL_NO_RECIPIENTS' || reason === 'no_recipients') {
    return `E-mail de venda paga NÃO tentado${pedido} — nenhum destinatário da loja${extra}`;
  }
  if (
    event === 'MAIL_PROVIDER_OFF_STORE_NOTIFY' ||
    event === 'MAIL_PROVIDER_OFF' ||
    reason === 'smtp_not_configured'
  ) {
    return `E-mail de venda paga NÃO enviado${pedido} — provedor de e-mail desligado${extra}`;
  }
  return `E-mail de venda paga FALHOU${pedido} — envio não concluiu (não é “nunca tentou”)${extra}`;
}

export function storeNotifyFailureActionPt(event?: string | null): string {
  const e = String(event || '');
  if (e === 'STORE_EMAIL_NO_RECIPIENTS') {
    return 'Confira STORE_NOTIFY_EMAIL e admins ativos. Use Reenviar aviso loja no pedido. Pagamento não foi revertido.';
  }
  if (e === 'MAIL_PROVIDER_OFF_STORE_NOTIFY' || e === 'MAIL_PROVIDER_OFF') {
    return 'Configure MAIL_FROM + RESEND_API_KEY (ou SMTP). In-app da loja ainda pode existir. Pagamento não foi revertido.';
  }
  return 'Use Reenviar aviso loja no pedido. Se persistir, confira Resend/domínio. Pagamento não foi revertido.';
}

export function peekStoreNotifyMailSnapshot(): StoreNotifyMailSnapshot {
  const recent = failures.slice(0, STORE_NOTIFY_FAILURE_CAP);
  const ids = new Set(recent.map((f) => f.publicId).filter(Boolean));
  return {
    last: recent[0] ?? null,
    openCount: ids.size,
    recent,
  };
}

export function recordStoreNotifyMailFailure(
  input: Omit<StoreNotifyMailFailure, 'at'> & { at?: string | Date },
): StoreNotifyMailFailure {
  const row: StoreNotifyMailFailure = {
    at: nowIso(input.at),
    publicId: String(input.publicId || '').trim(),
    orderId: input.orderId ? String(input.orderId) : null,
    event: input.event,
    reason: String(input.reason || 'send_failed'),
    mode: input.mode == null ? null : String(input.mode),
  };
  failures = [row, ...failures.filter((f) => f.publicId !== row.publicId)].slice(
    0,
    STORE_NOTIFY_FAILURE_CAP,
  );
  return row;
}

/** Clear a publicId after a successful store e-mail (or all if blank). */
export function recordStoreNotifyMailSuccess(publicId?: string | null): void {
  const id = String(publicId || '').trim();
  if (!id) {
    failures = [];
    return;
  }
  failures = failures.filter((f) => f.publicId !== id);
}

/** Test helper — do not call from request paths. */
export function resetStoreNotifyMailFailuresForTests(): void {
  failures = [];
}
