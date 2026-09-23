/**
 * Prime estorno — copy and eligibility for POST /admin/payments/:id/refund.
 * No network. The order allowlist mirrors the API transition to refunded.
 */

import { ENTERPRISE_MISSING, moneyOrDash, textOrDash } from './admin-enterprise-ui';

/** Statuses whose API allowlist includes → refunded. Delivered/cancelled/refunded do not. */
export const REFUND_ALLOWED_ORDER_STATUSES = [
  'paid',
  'organizing',
  'packing',
  'ready_for_pickup',
  'in_transit',
  'separating',
  'shipped',
] as const;

/** Still in the warehouse: API restocks these on refund. */
const REFUND_RESTOCK_ORDER_STATUSES = ['paid', 'organizing', 'packing', 'separating'] as const;

export type RefundPaymentInput = {
  id?: string | null;
  status?: string | null;
  method?: string | null;
  amount?: number | string | null;
};

export function isOrderRefundAllowed(status: string | null | undefined): boolean {
  const value = String(status || '').trim().toLowerCase();
  return (REFUND_ALLOWED_ORDER_STATUSES as readonly string[]).includes(value);
}

/** Local payment ids only (cuid/uuid). Rejects path characters so the POST path stays one segment. */
export function isRefundPaymentId(id: string | null | undefined): boolean {
  const value = String(id || '').trim();
  return /^[A-Za-z0-9_-]{8,80}$/.test(value);
}

export function refundablePayments<T extends RefundPaymentInput>(
  payments: readonly T[] | null | undefined,
): T[] {
  if (!payments?.length) return [];
  return payments.filter(
    (payment) =>
      String(payment.status || '').trim().toLowerCase() === 'approved' &&
      isRefundPaymentId(payment.id),
  );
}

/** Button is offered only when the order can go to refunded and a payment is approved. */
export function paymentRefundOffer<T extends RefundPaymentInput>(order: {
  status?: string | null;
  payments?: readonly T[] | null;
}): T[] {
  if (!isOrderRefundAllowed(order.status)) return [];
  return refundablePayments(order.payments);
}

export function paymentRefundAttentionCopy(input: {
  publicId?: string | null;
  count: number;
}): { title: string; detail: string } {
  const count = Number.isFinite(input.count) ? Math.max(0, Math.trunc(input.count)) : 0;
  const publicId = textOrDash(input.publicId);
  return {
    title:
      count === 1
        ? `Atenção: estorno disponível em ${publicId}`
        : `Atenção: ${count} estornos disponíveis em ${publicId}`,
    detail:
      'Pagamento approved e o pedido aceita reembolso. O dinheiro sai pelo Mercado Pago só depois de confirmar. Voltar não chama a API.',
  };
}

export function paymentRefundRowLine(payment: RefundPaymentInput): string {
  return [
    `id ${textOrDash(payment.id)}`,
    textOrDash(payment.method),
    moneyOrDash(payment.amount),
    textOrDash(payment.status),
  ].join(' · ');
}

function restockSentence(orderStatus: string | null | undefined): string {
  const value = String(orderStatus || '').trim().toLowerCase();
  if ((REFUND_RESTOCK_ORDER_STATUSES as readonly string[]).includes(value)) {
    return 'Este estado ainda está no depósito: o estoque dos itens volta.';
  }
  return 'Este estado já passou da coleta: o estorno não repõe estoque automaticamente.';
}

export function paymentRefundConfirmCopy(input: {
  publicId?: string | null;
  orderId?: string | null;
  orderStatus?: string | null;
  paymentId?: string | null;
  amount?: number | string | null;
}): { title: string; detail: string } {
  const publicId = textOrDash(input.publicId);
  const orderId = textOrDash(input.orderId);
  const paymentId = textOrDash(input.paymentId);
  const amount = moneyOrDash(input.amount);
  return {
    title: `Estornar pagamento de ${publicId}?`,
    detail: [
      `Pedido ${publicId} · id ${orderId}.`,
      `Pagamento ${paymentId}.`,
      `Valor ${amount}.`,
      'POST /admin/payments/:id/refund.',
      'O dinheiro sai pelo Mercado Pago na hora.',
      restockSentence(input.orderStatus),
      'Voltar não chama a API.',
    ].join(' '),
  };
}

export function paymentRefundSuccessMessage(input: {
  publicId?: string | null;
  idempotent?: boolean | null;
}): string {
  const publicId = textOrDash(input.publicId);
  if (input.idempotent === true) {
    return `Pagamento de ${publicId} já estava estornado. Nada novo foi enviado ao Mercado Pago.`;
  }
  return `Estorno confirmado para ${publicId}. Pagamento e pedido ficaram reembolsados.`;
}

const REFUND_ERROR_COPY: Record<string, string> = {
  PAYMENT_NOT_FOUND: 'Pagamento não encontrado. Nada foi estornado.',
  PAYMENT_NOT_APPROVED: 'Somente pagamento approved pode ser estornado. Nada foi enviado ao Mercado Pago.',
  ORDER_REFUND_NOT_ALLOWED: 'Este pedido não permite estorno neste estado. Nada foi enviado ao Mercado Pago.',
  PAYMENT_NO_EXTERNAL_ID: 'Pagamento sem externalId. Nada foi enviado ao Mercado Pago.',
  PROVIDER_REFUND_PENDING:
    'O Mercado Pago não confirmou o estorno. O pedido local não foi marcado como reembolsado.',
};

export function readApiErrorCode(err: unknown): string {
  if (!err || typeof err !== 'object' || !('code' in err)) return '';
  const code = (err as { code?: unknown }).code;
  if (typeof code !== 'string') return '';
  const trimmed = code.trim();
  return /^[A-Z0-9_]{2,64}$/.test(trimmed) ? trimmed : '';
}

export function paymentRefundErrorText(code: unknown, message: unknown): string {
  const known = typeof code === 'string' ? code.trim() : '';
  const mapped = known ? REFUND_ERROR_COPY[known] : undefined;
  if (mapped) return `${known}: ${mapped}`;
  const text = typeof message === 'string' ? message.trim() : '';
  if (known && text) return `${known}: ${text}`;
  if (known) return `${known}: A API não confirmou o estorno.`;
  if (text) return text;
  return 'A API não confirmou o estorno. Nada foi assumido como reembolsado.';
}

export const PAYMENT_REFUND_LIST_STALE =
  'A lista não recarregou. Atualize Pedidos antes de outro estorno.';

export function paymentRefundRefreshFailureText(success: string): string {
  const lead = success.trim() || `Estorno confirmado. ${ENTERPRISE_MISSING}`;
  return `${lead} ${PAYMENT_REFUND_LIST_STALE}`;
}
