export const ORDER_TRANSITIONS: Record<string, string[]> = {
  draft: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['separating', 'refunded'],
  separating: ['shipped', 'refunded'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: string, to: string) {
  return (ORDER_TRANSITIONS[from] || []).includes(to);
}
