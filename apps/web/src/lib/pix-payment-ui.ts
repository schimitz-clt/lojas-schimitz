/**
 * PIX QR / copia-e-cola gate for the customer order page.
 * Root rule: never show pay-now UI after payment or order left awaiting/draft.
 */

/** Order statuses still waiting for the customer to pay. */
export const PIX_AWAITING_ORDER_STATUSES = ['awaiting_payment', 'draft'] as const;

/** Post-payment / fulfillment — QR must never appear. */
export const PIX_PAID_LIKE_ORDER_STATUSES = [
  'paid',
  'organizing',
  'packing',
  'ready_for_pickup',
  'in_transit',
  'delivered',
  'separating',
  'shipped',
] as const;

/** Active (not terminal) orders for "Pedido em andamento" cards. */
export const IN_PROGRESS_ORDER_STATUSES = [
  'draft',
  'awaiting_payment',
  'paid',
  'organizing',
  'packing',
  'ready_for_pickup',
  'in_transit',
  'separating',
  'shipped',
] as const;

export const PIX_APPROVED_COPY = 'Pagamento PIX: Aprovado';

/**
 * Show QR / copia-e-cola / "escaneie/pague agora" ONLY when both are true:
 * - payment.status === 'pending'
 * - order.status === 'awaiting_payment' | 'draft'
 */
export function showPixGate(paymentStatus?: string | null, orderStatus?: string | null): boolean {
  if (paymentStatus !== 'pending') return false;
  return (PIX_AWAITING_ORDER_STATUSES as readonly string[]).includes(String(orderStatus || ''));
}

export function isPixPaidLikeOrder(orderStatus?: string | null): boolean {
  return (PIX_PAID_LIKE_ORDER_STATUSES as readonly string[]).includes(String(orderStatus || ''));
}

export function isInProgressOrderStatus(status?: string | null): boolean {
  return (IN_PROGRESS_ORDER_STATUSES as readonly string[]).includes(String(status || ''));
}

/** Newest-first list from GET /orders — pick first in-progress, else null. */
export function pickInProgressOrder<T extends { status: string }>(orders: T[]): T | null {
  if (!Array.isArray(orders) || orders.length === 0) return null;
  const hit = orders.find((o) => isInProgressOrderStatus(o.status));
  return hit ?? null;
}
