/**
 * Regras puras do pedido de exclusão de conta (LGPD art. 18 / Google Play).
 * Sem migration: o pedido vive no AuditLog (entity=User, entityId=userId).
 */
export const DELETION_REQUESTED = 'account.deletion_requested';
export const DELETION_CANCELLED = 'account.deletion_cancelled';
export const DELETION_PROCESSED = 'account.deletion_processed';
export const DELETION_ACTIONS = [DELETION_REQUESTED, DELETION_CANCELLED, DELETION_PROCESSED] as const;

/** Prazo que a página pública promete para concluir o pedido. */
export const DELETION_SLA_DAYS = 15;
export const DELETION_REASON_MAX = 300;
export const ANONYMIZED_NAME = 'Conta excluída';
export const ANONYMIZED_EMAIL_DOMAIN = 'conta-excluida.invalid';

/** Pedidos ainda em andamento: a conta só é anonimizada depois que terminarem. */
export const OPEN_ORDER_STATUSES = [
  'awaiting_payment',
  'paid',
  'separating',
  'organizing',
  'packing',
  'ready_for_pickup',
  'shipped',
  'in_transit',
] as const;

export type DeletionEvent = { action: string; createdAt: Date };
export type DeletionState =
  | { status: 'none' }
  | { status: 'pending'; requestedAt: Date }
  | { status: 'processed'; processedAt: Date };

/** Estado atual = último evento relevante (ordem cronológica). */
export function deletionStateFromEvents(events: DeletionEvent[]): DeletionState {
  const sorted = [...events]
    .filter((e) => (DELETION_ACTIONS as readonly string[]).includes(e.action))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const last = sorted[sorted.length - 1];
  if (!last || last.action === DELETION_CANCELLED) return { status: 'none' };
  if (last.action === DELETION_PROCESSED) return { status: 'processed', processedAt: last.createdAt };
  return { status: 'pending', requestedAt: last.createdAt };
}

export function anonymizedEmail(userId: string): string {
  return `excluido-${userId}@${ANONYMIZED_EMAIL_DOMAIN}`;
}

export function isAnonymizedEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${ANONYMIZED_EMAIL_DOMAIN}`);
}

/** Texto livre do cliente: corta, tira quebras e não guarda nada além de 300 caracteres. */
export function cleanDeletionReason(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.replace(/\s+/g, ' ').trim();
  return v ? v.slice(0, DELETION_REASON_MAX) : null;
}

export type ProcessBlocker = 'not_customer' | 'seller_owner' | 'open_orders' | 'already_processed' | 'not_requested';

export function processBlocker(input: {
  role: string;
  sellersOwned: number;
  openOrders: number;
  state: DeletionState;
}): ProcessBlocker | null {
  if (input.state.status === 'processed') return 'already_processed';
  if (input.state.status !== 'pending') return 'not_requested';
  if (input.role !== 'customer') return 'not_customer';
  if (input.sellersOwned > 0) return 'seller_owner';
  if (input.openOrders > 0) return 'open_orders';
  return null;
}

export const PROCESS_BLOCKER_MESSAGE: Record<ProcessBlocker, string> = {
  not_customer: 'Conta de equipe (admin/vendedor) não é excluída por este fluxo.',
  seller_owner: 'Usuário é dono de um vendedor do marketplace: desvincule antes.',
  open_orders: 'Há pedidos em andamento. Conclua, cancele ou entregue antes de excluir.',
  already_processed: 'Esta conta já foi excluída.',
  not_requested: 'Não há pedido de exclusão aberto para esta conta.',
};

/** Eventos no mesmo milissegundo seriam ambíguos: o próximo sempre fica depois do último. */
export function nextEventAt(now: Date, last?: Date | null): Date {
  if (last && now.getTime() <= last.getTime()) return new Date(last.getTime() + 1);
  return now;
}
