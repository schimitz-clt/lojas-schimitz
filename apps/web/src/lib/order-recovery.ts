/** Last created/viewed publicId — recovery after leaving the PIX page. */
export const LAST_ORDER_PUBLIC_ID_KEY = 'sch_last_order_publicId';

export const PIX_LEAVE_COPY =
  'Pode sair desta página. O pedido já está salvo. Guarde o código e acompanhe em Meus pedidos — o status atualiza quando o pagamento for confirmado.';

export const CUSTOMER_VISIBLE_ORDER_STATUSES = [
  'draft',
  'awaiting_payment',
  'paid',
  'organizing',
  'packing',
  'ready_for_pickup',
  'in_transit',
  'delivered',
  'cancelled',
  'refunded',
  'separating',
  'shipped',
] as const;

export function isCustomerVisibleOrderStatus(status: string): boolean {
  return (CUSTOMER_VISIBLE_ORDER_STATUSES as readonly string[]).includes(status);
}

export function orderRecoveryPaths(publicId: string) {
  const id = String(publicId || '').trim();
  return {
    verMeuPedido: id ? `/pedidos/${id}` : '/pedidos',
    meusPedidos: '/pedidos',
  };
}

export function persistLastOrderPublicId(
  publicId: string,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  const id = String(publicId || '').trim();
  if (!id) return;
  try {
    storage?.setItem(LAST_ORDER_PUBLIC_ID_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readLastOrderPublicId(storage?: Pick<Storage, 'getItem'> | null): string | null {
  try {
    const raw = storage?.getItem(LAST_ORDER_PUBLIC_ID_KEY);
    const id = typeof raw === 'string' ? raw.trim() : '';
    return id || null;
  } catch {
    return null;
  }
}

export function loginNextPath(path: string): string {
  const p = path.startsWith('/') && !path.startsWith('//') ? path : '/pedidos';
  return `/entrar?next=${encodeURIComponent(p)}`;
}
