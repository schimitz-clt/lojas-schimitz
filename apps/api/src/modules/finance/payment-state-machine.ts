/**
 * COMANDO OMEGA — explicit payment state machine (pure, no I/O).
 *
 * Local `Payment.status` (enum PaymentStatus) stays the operational field used by the existing
 * checkout/webhook code. `Payment.financialState` is the richer financial view that can also
 * represent states the legacy enum cannot (partial refund, dispute, chargeback won/lost).
 *
 * Every change of financialState goes through `assertPaymentTransition` / `canPaymentTransition`.
 */

export const PAYMENT_STATES = [
  'CREATED',
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'IN_DISPUTE',
  'CHARGEBACK_WON',
  'CHARGEBACK_LOST',
] as const;

export type PaymentState = (typeof PAYMENT_STATES)[number];

/**
 * Allowlist. Anything not listed is forbidden — notably:
 *  REFUNDED → PAID, CHARGEBACK_LOST → PAID, FAILED → PAID, PARTIALLY_REFUNDED → PAID.
 *
 * EXPIRED/CANCELLED → PAID are allowed on purpose: a PIX can settle at the bank after our
 * reservation expired (or after a best-effort remote cancel failed). The money is real, so the
 * ledger must record it; the reconciliation engine flags the order as CRITICAL for follow-up.
 */
export const PAYMENT_TRANSITIONS: Record<PaymentState, readonly PaymentState[]> = {
  CREATED: ['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'],
  PENDING: ['AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'],
  AUTHORIZED: ['PAID', 'FAILED', 'CANCELLED', 'EXPIRED'],
  PAID: ['PARTIALLY_REFUNDED', 'REFUNDED', 'IN_DISPUTE', 'CHARGEBACK_WON', 'CHARGEBACK_LOST'],
  FAILED: [],
  CANCELLED: ['PAID'],
  EXPIRED: ['PAID'],
  PARTIALLY_REFUNDED: ['REFUNDED', 'IN_DISPUTE', 'CHARGEBACK_WON', 'CHARGEBACK_LOST'],
  REFUNDED: [],
  IN_DISPUTE: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGEBACK_WON', 'CHARGEBACK_LOST'],
  CHARGEBACK_WON: ['PARTIALLY_REFUNDED', 'REFUNDED'],
  CHARGEBACK_LOST: [],
};

export const TERMINAL_PAYMENT_STATES: readonly PaymentState[] = ['FAILED', 'REFUNDED', 'CHARGEBACK_LOST'];

/** States in which money is (still) considered received by the store. */
export const MONEY_RECEIVED_STATES: readonly PaymentState[] = [
  'PAID',
  'PARTIALLY_REFUNDED',
  'IN_DISPUTE',
  'CHARGEBACK_WON',
];

export function isPaymentState(v: unknown): v is PaymentState {
  return typeof v === 'string' && (PAYMENT_STATES as readonly string[]).includes(v);
}

export function canPaymentTransition(from: PaymentState, to: PaymentState): boolean {
  if (from === to) return true; // idempotent no-op
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export class ForbiddenPaymentTransitionError extends Error {
  readonly code = 'FORBIDDEN_PAYMENT_TRANSITION' as const;
  constructor(readonly from: PaymentState, readonly to: PaymentState) {
    super(`Transição de pagamento proibida: ${from} → ${to}`);
    this.name = 'ForbiddenPaymentTransitionError';
  }
}

export function assertPaymentTransition(from: PaymentState, to: PaymentState): void {
  if (!canPaymentTransition(from, to)) throw new ForbiddenPaymentTransitionError(from, to);
}

/** Legacy PaymentStatus enum → financial state (used for rows that never transitioned). */
export function stateFromLegacyStatus(status: string, externalId?: string | null): PaymentState {
  switch (status) {
    case 'pending':
      return externalId ? 'PENDING' : 'CREATED';
    case 'approved':
      return 'PAID';
    case 'refused':
      return 'FAILED';
    case 'expired':
      return 'EXPIRED';
    case 'cancelled':
      return 'CANCELLED';
    case 'refunded':
      return 'REFUNDED';
    default:
      return 'PENDING';
  }
}

export function currentPaymentState(p: {
  financialState?: string | null;
  status: string;
  externalId?: string | null;
}): PaymentState {
  if (isPaymentState(p.financialState)) return p.financialState;
  return stateFromLegacyStatus(p.status, p.externalId);
}

/** What Mercado Pago (source of truth) reported, beyond the legacy DomainPaymentStatus. */
export type ProviderObservation = {
  rawStatus?: string | null;
  statusDetail?: string | null;
  amount?: number | null;
  refundedAmount?: number | null;
};

/**
 * Decide the target financial state from the local status (what the domain accepted) enriched by
 * the provider observation for states the legacy enum cannot hold.
 *
 * Money that MP captured but the domain refused (amount/reference mismatch) is NOT marked PAID:
 * local status stays pending and the reconciliation engine raises a CRITICAL discrepancy.
 */
export function targetPaymentState(
  local: { status: string; externalId?: string | null; amount: number },
  obs?: ProviderObservation | null,
): PaymentState {
  const base = stateFromLegacyStatus(local.status, local.externalId);
  if (!obs) return base;
  const raw = String(obs.rawStatus || '').toLowerCase();
  const detail = String(obs.statusDetail || '').toLowerCase();

  if (local.status === 'pending' && raw === 'authorized') return 'AUTHORIZED';

  if (local.status === 'approved') {
    if (raw === 'in_mediation') return 'IN_DISPUTE';
    if (raw === 'charged_back') {
      // MP status_detail for charged_back: settled (money withdrawn) | reimbursed (covered) | in_process
      if (detail === 'reimbursed') return 'CHARGEBACK_WON';
      if (detail === 'settled') return 'CHARGEBACK_LOST';
      return 'IN_DISPUTE';
    }
    if (raw === 'refunded') return 'REFUNDED';
    const refunded = Number(obs.refundedAmount || 0);
    if (refunded > 0.009) {
      return refunded + 0.009 >= Number(local.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    }
  }
  return base;
}

/**
 * Final target used by the recorder: without a provider observation, an `approved` local row that
 * already sits in a richer money-received state (partial refund, dispute, chargeback) keeps it —
 * the legacy enum simply cannot express it, which is not a regression signal.
 */
export function resolveTargetState(
  current: PaymentState,
  local: { status: string; externalId?: string | null; amount: number },
  obs?: ProviderObservation | null,
): PaymentState {
  const hasObs = Boolean(obs && (obs.rawStatus || obs.refundedAmount != null));
  if (!hasObs && local.status === 'approved') {
    if (current === 'PARTIALLY_REFUNDED' || current === 'IN_DISPUTE' || current === 'CHARGEBACK_WON' || current === 'CHARGEBACK_LOST') {
      return current;
    }
  }
  if (!hasObs && local.status === 'pending' && current === 'AUTHORIZED') return current;
  return targetPaymentState(local, obs);
}

/** Portuguese labels for the admin UI. */
export const PAYMENT_STATE_LABEL_PT: Record<PaymentState, string> = {
  CREATED: 'Criado',
  PENDING: 'Pendente',
  AUTHORIZED: 'Autorizado',
  PAID: 'Pago',
  FAILED: 'Recusado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
  PARTIALLY_REFUNDED: 'Estorno parcial',
  REFUNDED: 'Estornado',
  IN_DISPUTE: 'Em disputa',
  CHARGEBACK_WON: 'Chargeback ganho',
  CHARGEBACK_LOST: 'Chargeback perdido',
};
