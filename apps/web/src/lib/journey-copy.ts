/**
 * Regras e textos da jornada de compra que ficam fora das páginas para serem testados:
 * erro de pedido que se corrige na sacola, pedido pendente a retomar, prazo da reserva e pagamento recusado.
 * Nada aqui decide preço, estoque ou pagamento — quem decide é o servidor.
 */

/** Códigos da API de pedidos cuja correção está na sacola (item sem estoque / indisponível). */
const CART_FIXABLE_CODES = new Set(['INSUFFICIENT_STOCK', 'INVENTORY_MISSING', 'CART_EMPTY']);

export function isCartFixableOrderError(code?: string | null, message?: string | null): boolean {
  if (code && CART_FIXABLE_CODES.has(code)) return true;
  return /indispon[ií]vel|estoque insuficiente|sem invent[aá]rio/i.test(String(message || ''));
}

export type OrderListEntry = { publicId: string; status: string; createdAt?: string | null };

/** Pedido mais recente aguardando pagamento: é para onde o cliente volta se a sacola está vazia. */
export function pendingOrderToResume(orders: OrderListEntry[] | null | undefined): OrderListEntry | null {
  const pending = (orders || []).filter((o) => o && o.status === 'awaiting_payment' && o.publicId);
  if (!pending.length) return null;
  return [...pending].sort(
    (a, b) => Date.parse(String(b.createdAt || 0)) - Date.parse(String(a.createdAt || 0)),
  )[0];
}

export const PENDING_ORDER_RESUME_COPY =
  'Seu pedido já foi criado e está aguardando pagamento. Termine o pagamento por ele, sem criar outro.';

function hhmm(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Aviso do prazo em que os itens ficam reservados enquanto o pedido espera pagamento. */
export function reservationNotice(
  expiresAtIso: string | null | undefined,
  now: Date = new Date(),
): { text: string; expired: boolean } | null {
  if (!expiresAtIso) return null;
  const at = new Date(expiresAtIso);
  if (Number.isNaN(at.getTime())) return null;
  if (at.getTime() <= now.getTime()) {
    return {
      expired: true,
      text: 'O prazo de reserva dos itens terminou. O pedido será cancelado e o estoque liberado; se ainda quiser os produtos, faça um novo pedido.',
    };
  }
  return {
    expired: false,
    text: `Itens reservados para você até ${hhmm(at)} (horário de Brasília). Depois disso o pedido é cancelado e o estoque volta para a loja.`,
  };
}

export const PAYMENT_REFUSED_COPY =
  'O pagamento foi recusado e nada foi cobrado. Confira os dados e tente de novo, use outro cartão ou pague com PIX.';

export type PaymentLike = { status: string; method?: string; createdAt?: string | null };

/** Houve tentativa recusada e não há pagamento pendente/aprovado: o cliente precisa poder tentar de novo. */
export function hasRefusedAttemptOnly(payments: PaymentLike[] | null | undefined): boolean {
  const list = payments || [];
  if (list.some((p) => p.status === 'pending' || p.status === 'approved')) return false;
  return list.some((p) => p.status === 'refused');
}
