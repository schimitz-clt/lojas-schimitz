/** Rótulos PT alinhados ao enum OrderStatus da API. */
export const ORDER_STATUS_LABEL: Record<string, string> = {
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

/** Timeline de entrega (após pagamento) para a vitrine — entrega própria. */
export const FULFILLMENT_STEPS = [
  'paid',
  'organizing',
  'packing',
  'ready_for_pickup',
  'in_transit',
  'delivered',
] as const;


/** Jornada do cliente na timeline: Compra → … → Entrega */
export const FULFILLMENT_TIMELINE_LABEL: Record<string, string> = {
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
  return FULFILLMENT_TIMELINE_LABEL[status] || orderStatusLabel(status);
}

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABEL[status] || status;
}

/** Próximo status de fulfillment que o admin pode avançar com um clique. */
export function nextFulfillmentStatus(
  status: string,
):
  | 'organizing'
  | 'packing'
  | 'ready_for_pickup'
  | 'in_transit'
  | 'delivered'
  | null {
  if (status === 'paid') return 'organizing';
  if (status === 'organizing') return 'packing';
  if (status === 'packing') return 'ready_for_pickup';
  if (status === 'ready_for_pickup') return 'in_transit';
  if (status === 'in_transit') return 'delivered';
  if (status === 'separating') return 'packing';
  if (status === 'shipped') return 'delivered';
  return null;
}

/** Mapeia status legado para o índice da timeline nova. */
function normalizeForTimeline(status: string): string {
  if (status === 'separating') return 'organizing';
  if (status === 'shipped') return 'in_transit';
  return status;
}

export function fulfillmentStepIndex(status: string): number {
  const normalized = normalizeForTimeline(status);
  const i = (FULFILLMENT_STEPS as readonly string[]).indexOf(normalized);
  if (i >= 0) return i;
  if (status === 'awaiting_payment' || status === 'draft') return -1;
  if (status === 'cancelled' || status === 'refunded') return -1;
  return -1;
}

/** Buckets da fila operacional (admin) — alinhados à API. */
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

export const PROBLEM_ORDER_STATUSES = [
  'cancelled',
  'refunded',
  'separating',
  'shipped',
] as const;

export const ADMIN_QUEUE_BUCKET_LABEL: Record<string, string> = {
  awaiting_payment: 'Aguardando pagamento',
  paid: 'Pago',
  organizing: 'Organizando',
  packing: 'Em embalagem',
  ready_for_pickup: 'Pronto para coleta',
  in_transit: 'Em trânsito',
  delivered: 'Entregue',
  problems: 'Problemas',
};

/** Pagamento → paid; próximo passo manual: organizing. */
export const POST_PAYMENT_OPS_HINT =
  'Após o pagamento o pedido fica em Pago. Use “Marcar: Organizando” para iniciar a separação — não há transição automática.';

export function adminQueueBucketLabel(key: string) {
  return ADMIN_QUEUE_BUCKET_LABEL[key] || orderStatusLabel(key);
}

