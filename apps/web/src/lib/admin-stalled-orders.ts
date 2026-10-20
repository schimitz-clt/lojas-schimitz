/** Tela "Pedidos parados" — regras puras de apresentação (sem I/O, sem números inventados). */
import { buildAdminPedidoHref } from './admin-customers-ui';

export type StalledReason = 'paid_awaiting_org' | 'prep_stuck' | 'shipped_no_tracking';

export type StalledOrderItem = {
  id: string;
  publicId: string;
  status: string;
  reason: StalledReason | string;
  since: string;
  ageHours: number;
  customerName: string | null;
  total: number | null;
};

export type StalledOrdersPayload = {
  generatedAt: string;
  paidHours: number;
  stuckDays: number;
  count: number;
  items: StalledOrderItem[];
};

export const STALLED_REASON_LABEL: Record<StalledReason, string> = {
  paid_awaiting_org: 'Pago, aguardando organizar',
  prep_stuck: 'Separação parada',
  shipped_no_tracking: 'Enviado sem rastreio',
};

export const STALLED_REASON_HINT: Record<StalledReason, string> = {
  paid_awaiting_org: 'Confirme com o fornecedor e mova para Organizando.',
  prep_stuck: 'Confirme com o fornecedor e atualize o status do pedido.',
  shipped_no_tracking: 'Informe o código no bloco "Rastreio" do pedido.',
};

export const STALLED_EMPTY_TITLE = 'Nenhum pedido parado agora.';

export function stalledReasonLabel(reason: string): string {
  return (STALLED_REASON_LABEL as Record<string, string>)[reason] ?? 'Atenção';
}

export function stalledReasonHint(reason: string): string {
  return (STALLED_REASON_HINT as Record<string, string>)[reason] ?? '';
}

export function stalledReasonTone(reason: string): 'danger' | 'warn' {
  return reason === 'paid_awaiting_org' ? 'danger' : 'warn';
}

/** "3 h", "2 dias", "1 dia" — idade em linguagem simples. */
export function formatStalledAge(ageHours: number): string {
  const h = Number.isFinite(ageHours) ? Math.max(0, Math.floor(ageHours)) : 0;
  if (h < 48) return `${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 dia' : `${d} dias`;
}

export function stalledOrderHref(item: Pick<StalledOrderItem, 'id'>): string {
  return buildAdminPedidoHref(item.id);
}

/** Contagem por motivo, sempre com as 3 chaves (zero real, pois vem da lista completa). */
export function countStalledByReason(items: StalledOrderItem[]): Record<StalledReason, number> {
  const out: Record<StalledReason, number> = { paid_awaiting_org: 0, prep_stuck: 0, shipped_no_tracking: 0 };
  for (const i of items) if (i.reason in out) out[i.reason as StalledReason] += 1;
  return out;
}

export function stalledRulesLede(p: Pick<StalledOrdersPayload, 'paidHours' | 'stuckDays'>): string {
  return `Pago há mais de ${p.paidHours} h sem organizar, em separação há mais de ${p.stuckDays} dia(s), ou enviado sem código de rastreio.`;
}
