/**
 * Alertas de atendimento para venda sob encomenda (compra no fornecedor após a venda).
 * Regras puras, sem I/O. O sistema não tem campo de fornecedor/confirmação: "fornecedor não
 * confirmado" é aproximado por pedido parado em separação além do limite.
 */
export const FULFILLMENT_STUCK_DAYS_DEFAULT = 3;
const IN_PREP = new Set(['organizing', 'separating', 'packing']);
const SHIPPED = new Set(['in_transit', 'shipped']);

export type FulfillmentRow = { publicId: string; status: string; since: Date; trackingCode: string | null };

export function fulfillmentStuckDays(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number.parseInt(String(env.FULFILLMENT_STUCK_DAYS ?? ''), 10);
  return Number.isFinite(n) && n >= 1 && n <= 60 ? n : FULFILLMENT_STUCK_DAYS_DEFAULT;
}

export function summarizeFulfillmentAttention(rows: FulfillmentRow[], now = new Date(), stuckDays = FULFILLMENT_STUCK_DAYS_DEFAULT) {
  const limitMs = stuckDays * 86_400_000;
  const prepStuck = rows.filter((r) => IN_PREP.has(r.status) && now.getTime() - r.since.getTime() >= limitMs);
  const shippedNoTracking = rows.filter((r) => SHIPPED.has(r.status) && !String(r.trackingCode ?? '').trim());
  return {
    stuckDays,
    prepStuckCount: prepStuck.length,
    prepStuckPublicIds: prepStuck.slice(0, 20).map((r) => r.publicId),
    shippedNoTrackingCount: shippedNoTracking.length,
    shippedNoTrackingPublicIds: shippedNoTracking.slice(0, 20).map((r) => r.publicId),
    hint:
      'Separação parada: confirme com o fornecedor e atualize o pedido. Enviado sem rastreio: informe o código no bloco "Rastreio" do pedido.',
  };
}
