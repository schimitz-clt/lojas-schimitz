/** Rótulos PT alinhados ao enum OrderStatus da API. */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  awaiting_payment: 'Aguardando pagamento',
  paid: 'Pago',
  separating: 'Separando',
  shipped: 'Saiu para entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

/** Timeline de entrega (após pagamento) para a vitrine. */
export const FULFILLMENT_STEPS = ['paid', 'separating', 'shipped', 'delivered'] as const;

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABEL[status] || status;
}

/** Próximo status de fulfillment que o admin pode avançar com um clique. */
export function nextFulfillmentStatus(status: string): 'separating' | 'shipped' | 'delivered' | null {
  if (status === 'paid') return 'separating';
  if (status === 'separating') return 'shipped';
  if (status === 'shipped') return 'delivered';
  return null;
}

export function fulfillmentStepIndex(status: string): number {
  const i = (FULFILLMENT_STEPS as readonly string[]).indexOf(status);
  if (i >= 0) return i;
  if (status === 'awaiting_payment' || status === 'draft') return -1;
  if (status === 'cancelled' || status === 'refunded') return -1;
  return -1;
}
