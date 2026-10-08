import { useEffect } from 'react';

const FULFILLMENT_LIVE = new Set([
  'paid',
  'organizing',
  'packing',
  'ready_for_pickup',
  'in_transit',
  'separating',
  'shipped',
]);

/** Recarrega o pedido enquanto pagamento ou envio ainda podem mudar. */
export function useOrderLiveReload(
  status: string | undefined,
  paymentStatus: string | undefined,
  reload: () => Promise<unknown>,
) {
  useEffect(() => {
    if (!status) return;
    const awaiting = status === 'awaiting_payment' || status === 'draft';
    const payPending = paymentStatus === 'pending';
    const fulfillmentLive = FULFILLMENT_LIVE.has(status);
    if (!awaiting && !payPending && !fulfillmentLive) return;
    const ms = awaiting || payPending ? 4000 : 8000;
    const id = window.setInterval(() => {
      reload().catch(() => undefined);
    }, ms);
    return () => window.clearInterval(id);
  }, [status, paymentStatus, reload]);
}
