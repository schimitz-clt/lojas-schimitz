/** Transições válidas de OrderStatus (entrega própria + legado). */
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  draft: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['organizing', 'refunded'],
  organizing: ['packing', 'refunded'],
  packing: ['ready_for_pickup', 'refunded'],
  ready_for_pickup: ['in_transit', 'refunded'],
  in_transit: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
  /** Legado (pré SCH-007). */
  separating: ['packing', 'in_transit', 'shipped', 'refunded'],
  shipped: ['delivered'],
};

/** Passos de fulfillment após pagamento (UI / admin). */
export const FULFILLMENT_STATUSES = [
  'organizing',
  'packing',
  'ready_for_pickup',
  'in_transit',
  'delivered',
] as const;

export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const ORDER_STATUS_LABEL_PT: Record<string, string> = {
  draft: 'Rascunho',
  awaiting_payment: 'Aguardando pagamento',
  paid: 'Pago',
  organizing: 'Organizando',
  packing: 'Em embalagem',
  ready_for_pickup: 'Pronto para coleta',
  in_transit: 'Em trânsito',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  separating: 'Separando',
  shipped: 'Saiu para entrega',
};


/** Rótulos da jornada do cliente: Compra → … → Entrega (timeline da vitrine). */
export const FULFILLMENT_TIMELINE_LABEL_PT: Record<string, string> = {
  paid: 'Compra',
  organizing: 'Organizando',
  packing: 'Embalagem',
  ready_for_pickup: 'Pronto para envio',
  in_transit: 'Em trânsito',
  delivered: 'Entrega',
  separating: 'Organizando',
  shipped: 'Em trânsito',
};

export const FULFILLMENT_JOURNEY_COPY =
  'Compra → Organizando → Embalagem → Pronto para envio → Em trânsito → Entrega';

export function fulfillmentTimelineLabel(status: string) {
  return FULFILLMENT_TIMELINE_LABEL_PT[status] || orderStatusLabel(status);
}

export function canTransition(from: string, to: string) {
  return (ORDER_TRANSITIONS[from] || []).includes(to);
}

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABEL_PT[status] || status;
}

/** Próximo status de fulfillment (um clique no admin). */
export function nextFulfillmentStatus(status: string): FulfillmentStatus | 'shipped' | null {
  if (status === 'paid') return 'organizing';
  if (status === 'organizing') return 'packing';
  if (status === 'packing') return 'ready_for_pickup';
  if (status === 'ready_for_pickup') return 'in_transit';
  if (status === 'in_transit') return 'delivered';
  // legado
  if (status === 'separating') return 'packing';
  if (status === 'shipped') return 'delivered';
  return null;
}

/** Status pós-pagamento que contam como receita / elegíveis a review. */
export const POST_PAID_STATUSES = [
  'paid',
  'organizing',
  'packing',
  'ready_for_pickup',
  'in_transit',
  'delivered',
  'separating',
  'shipped',
] as const;

/** Estorno com reposição automática de estoque (ainda no depósito). */
export const REFUND_RESTOCK_STATUSES = ['paid', 'organizing', 'packing', 'separating'] as const;

/** Estorno permitido sem restock automático (já embalado / em rota). */
export const REFUND_NO_RESTOCK_STATUSES = ['ready_for_pickup', 'in_transit', 'shipped'] as const;

export function isRefundAllowed(status: string) {
  return (
    (REFUND_RESTOCK_STATUSES as readonly string[]).includes(status) ||
    (REFUND_NO_RESTOCK_STATUSES as readonly string[]).includes(status)
  );
}

export function shouldRestockOnRefund(status: string) {
  return (REFUND_RESTOCK_STATUSES as readonly string[]).includes(status);
}

/** Buckets da fila operacional do admin (reusa OrderStatus; sem inventar status). */
export const ADMIN_ORDER_QUEUE_BUCKETS = [
  'awaiting_payment',
  'paid',
  'organizing',
  'packing',
  'ready_for_pickup',
  'in_transit',
  'delivered',
  'problems',
] as const;

export type AdminOrderQueueBucket = (typeof ADMIN_ORDER_QUEUE_BUCKETS)[number];

/**
 * "Problemas": cancelados/reembolsados + legado stuck (separating/shipped)
 * que ainda precisam de atenção do admin (avançar ou fechar).
 */
export const PROBLEM_ORDER_STATUSES = [
  'cancelled',
  'refunded',
  'separating',
  'shipped',
] as const;

/** Status reais do enum cobertos por um bucket da fila (problems é virtual). */
export function statusesForAdminQueueBucket(bucket: string): string[] {
  if (bucket === 'problems') return [...PROBLEM_ORDER_STATUSES];
  if ((ADMIN_ORDER_QUEUE_BUCKETS as readonly string[]).includes(bucket)) {
    return [bucket];
  }
  return [];
}

export function isAdminOrderQueueBucket(value: string): value is AdminOrderQueueBucket {
  return (ADMIN_ORDER_QUEUE_BUCKETS as readonly string[]).includes(value);
}

/**
 * Pagamento CAS → `paid` apenas (não auto-organizing).
 * Próximo passo operacional seguro: admin one-click → organizing.
 */
export const POST_PAYMENT_OPS_HINT =
  'Pagamento confirma status paid. Próximo passo: admin marca organizing (não há auto-transition para organizing).';

export function bucketForOrderStatus(status: string): AdminOrderQueueBucket | 'draft' | null {
  if (status === 'draft') return 'draft';
  if ((PROBLEM_ORDER_STATUSES as readonly string[]).includes(status)) return 'problems';
  if ((ADMIN_ORDER_QUEUE_BUCKETS as readonly string[]).includes(status)) {
    return status as AdminOrderQueueBucket;
  }
  return null;
}

