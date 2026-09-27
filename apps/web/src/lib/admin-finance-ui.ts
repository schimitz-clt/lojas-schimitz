/**
 * Admin "Financeiro" — pure helpers (labels, action validation). No fake numbers: every figure in
 * the UI comes from GET /admin/finance/* (database). Missing data renders as "—".
 */

export const FINANCE_MISSING = '—';

export const PAYMENT_STATE_LABEL_PT: Record<string, string> = {
  CREATED: 'Criado',
  PENDING: 'Pendente',
  AUTHORIZED: 'Autorizado',
  PAID: 'Pago',
  FAILED: 'Recusado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
  PARTIALLY_REFUNDED: 'Estornado parcial',
  REFUNDED: 'Estornado',
  IN_DISPUTE: 'Em disputa',
  CHARGEBACK_WON: 'Chargeback ganho',
  CHARGEBACK_LOST: 'Chargeback perdido',
};

export const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type Severity = (typeof SEVERITY_ORDER)[number];

export const SEVERITY_LABEL_PT: Record<Severity, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
};

export function severityTone(sev: string): 'danger' | 'warn' | 'info' | 'neutral' {
  if (sev === 'CRITICAL') return 'danger';
  if (sev === 'HIGH') return 'warn';
  if (sev === 'MEDIUM') return 'info';
  return 'neutral';
}

export function sortDiscrepancies<T extends { severity: string; lastSeenAt: string }>(rows: T[]): T[] {
  const rank = (s: string) => {
    const i = (SEVERITY_ORDER as readonly string[]).indexOf(s);
    return i < 0 ? 99 : i;
  };
  return [...rows].sort((a, b) => rank(a.severity) - rank(b.severity) || String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
}

export type FinanceActionKind = 'reprocess' | 'refund' | 'review' | 'clear_review' | 'resolve' | 'acknowledge' | 'reconcile_payment' | 'reconcile_period' | 'release_reservation';

export const FINANCE_ACTION_LABEL_PT: Record<FinanceActionKind, string> = {
  reprocess: 'Reprocessar no Mercado Pago',
  refund: 'Solicitar estorno',
  review: 'Marcar em revisão',
  clear_review: 'Liberar revisão',
  resolve: 'Resolver divergência',
  acknowledge: 'Reconhecer divergência',
  reconcile_payment: 'Reconciliar pagamento',
  reconcile_period: 'Reconciliar últimas 24h',
  release_reservation: 'Liberar reserva de estoque',
};

export type FinanceActionForm = { reason: string; confirm: boolean; amount?: string; severity?: string };

/** Mirrors the API rules (reason ≥10, confirm=true, CRITICAL resolve ≥30, refund amount ≤ refundable). */
export function validateFinanceAction(kind: FinanceActionKind, f: FinanceActionForm, opts?: { refundable?: number | null }): string | null {
  const reason = f.reason.trim();
  if (reason.length < 10) return 'Descreva o motivo (mínimo 10 caracteres).';
  if (!f.confirm) return 'Marque a confirmação para continuar.';
  if (kind === 'resolve' && f.severity === 'CRITICAL' && reason.length < 30) return 'Divergência crítica: detalhe o motivo (mínimo 30 caracteres).';
  if (kind === 'refund' && f.amount != null && f.amount.trim() !== '') {
    const v = Number(f.amount.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return 'Valor de estorno inválido.';
    if (Math.round(v * 100) !== v * 100) return 'Use no máximo 2 casas decimais.';
    if (opts?.refundable != null && v > opts.refundable + 0.001) return 'Valor acima do disponível para estorno.';
  }
  return null;
}

export function parseRefundAmount(raw?: string): number | undefined {
  if (raw == null || raw.trim() === '') return undefined;
  return Number(raw.replace(',', '.'));
}

/** Paid − refunds already completed/in-flight, from the payment detail payload. */
export function refundableFromDetail(detail: { payment: { amount: number }; refunds: { amount: number; status: string }[] } | null): number | null {
  if (!detail) return null;
  const used = detail.refunds.filter((r) => r.status !== 'FAILED').reduce((s, r) => s + Number(r.amount || 0), 0);
  return Math.max(0, Math.round((Number(detail.payment.amount) - used) * 100) / 100);
}
