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

/** Motivo pelo qual um pedido aparece na tela "Pedidos parados". */
export type StalledReason = 'paid_awaiting_org' | 'prep_stuck' | 'shipped_no_tracking';

export type StalledOrderRow = {
  id: string;
  publicId: string;
  status: string;
  /** Desde quando está no status atual (pago: histórico "paid"; demais: updatedAt). */
  since: Date;
  trackingCode: string | null;
  customerName?: string | null;
  total?: number | null;
};

export type StalledOrderItem = {
  id: string;
  publicId: string;
  status: string;
  reason: StalledReason;
  since: string;
  ageHours: number;
  customerName: string | null;
  total: number | null;
};

/**
 * Lista detalhada para a tela "Pedidos parados" — mesmas regras dos alertas do /admin/ops
 * (pago > paidHours sem organizar; separação > stuckDays; enviado sem rastreio). Mais antigos primeiro.
 */
export function listStalledOrders(
  rows: StalledOrderRow[],
  now = new Date(),
  opts: { paidHours: number; stuckDays: number },
): StalledOrderItem[] {
  const out: StalledOrderItem[] = [];
  for (const r of rows) {
    const t = r.since instanceof Date ? r.since.getTime() : new Date(r.since).getTime();
    if (!Number.isFinite(t)) continue;
    const ageH = Math.max(0, (now.getTime() - t) / 3_600_000);
    let reason: StalledReason | null = null;
    if (r.status === 'paid' && ageH >= opts.paidHours) reason = 'paid_awaiting_org';
    else if (IN_PREP.has(r.status) && ageH >= opts.stuckDays * 24) reason = 'prep_stuck';
    else if (SHIPPED.has(r.status) && !String(r.trackingCode ?? '').trim()) reason = 'shipped_no_tracking';
    if (!reason) continue;
    out.push({
      id: r.id,
      publicId: r.publicId,
      status: r.status,
      reason,
      since: new Date(t).toISOString(),
      ageHours: Math.floor(ageH),
      customerName: r.customerName ?? null,
      total: r.total == null || !Number.isFinite(Number(r.total)) ? null : Number(r.total),
    });
  }
  return out.sort((a, b) => b.ageHours - a.ageHours);
}
