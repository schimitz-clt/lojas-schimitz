/**
 * Depois do despacho, a previsão é despacho + N × 24h.
 * Na cotação (PDP e checkout) e no pedido ainda não despachado, o texto é
 * "Receba em N dias" / "Prazo: N dias" — sem "após o despacho" e sem data inventada.
 */

export type StatusHistoryLike = {
  toStatus: string;
  createdAt: string | Date;
};

export type FreightSnapLike = {
  estimatedDays?: number | string | null;
  days?: number | string | null;
} | null | undefined;

const DISPATCH_STATUSES = new Set(['in_transit', 'shipped']);

const PRE_DISPATCH_STATUSES = new Set([
  'paid',
  'organizing',
  'packing',
  'ready_for_pickup',
  'separating',
]);

/** Frase antiga relativa ao despacho. A vitrine e o checkout não usam isto. */
export function formatDaysAfterDispatch(days: number): string {
  const n = Math.max(0, Math.floor(Number(days) || 0));
  if (n === 1) return '1 dia após o despacho';
  return `${n} dias após o despacho`;
}

/** Prazo da cotação: "em 1 dia" / "em N dias". Sem calendário inventado. */
export function formatReceiveInDays(days: number): string {
  const n = Math.max(0, Math.floor(Number(days) || 0));
  if (n === 1) return 'em 1 dia';
  return `em ${n} dias`;
}

/** "Prazo: 1 dia" / "Prazo: N dias". */
export function formatPrazoDays(days: number): string {
  const n = Math.max(0, Math.floor(Number(days) || 0));
  if (n === 1) return 'Prazo: 1 dia';
  return `Prazo: ${n} dias`;
}

/** Dias estimados a partir do snap de frete do pedido (estimatedDays ou days). */
export function resolveEstimatedDays(snap: FreightSnapLike): number | null {
  if (!snap || typeof snap !== 'object') return null;
  const raw = snap.estimatedDays ?? snap.days;
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

/**
 * Primeira vez que o pedido entrou em in_transit ou legado shipped.
 * statusHistory deve estar em ordem cronológica (asc) ou qualquer ordem — usamos o earliest.
 */
export function findDispatchAt(statusHistory: StatusHistoryLike[] | undefined | null): Date | null {
  if (!statusHistory?.length) return null;
  let earliest: Date | null = null;
  for (const h of statusHistory) {
    if (!DISPATCH_STATUSES.has(h.toStatus)) continue;
    const at = h.createdAt instanceof Date ? h.createdAt : new Date(h.createdAt);
    if (Number.isNaN(at.getTime())) continue;
    if (!earliest || at.getTime() < earliest.getTime()) earliest = at;
  }
  return earliest;
}

/** ETA = despacho + N × 24 horas (não “dias de calendário”). */
export function etaAfterDispatch(dispatchAt: Date, days: number): Date {
  const n = Math.max(0, Math.floor(Number(days) || 0));
  return new Date(dispatchAt.getTime() + n * 24 * 60 * 60 * 1000);
}

/** Formata data/hora em America/Sao_Paulo (pt-BR). */
export function formatEtaPt(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function isPreDispatchStatus(status: string): boolean {
  return PRE_DISPATCH_STATUSES.has(status);
}

export function isDispatchedStatus(status: string): boolean {
  return DISPATCH_STATUSES.has(status);
}

/**
 * Texto de prazo para a página do pedido, sem inventar datas.
 * - despachado + dias: ETA exata
 * - pré-despacho + dias: "Prazo: N dia(s)" (sem "após o despacho")
 * - entregue: entregue (+ se ETA conhecida, se cumpriu)
 */
export function deliveryEtaCopy(input: {
  status: string;
  statusHistory?: StatusHistoryLike[] | null;
  freightSnap?: FreightSnapLike;
  deliveredAt?: Date | null;
}): string | null {
  const days = resolveEstimatedDays(input.freightSnap);
  const dispatchAt = findDispatchAt(input.statusHistory);

  if (input.status === 'delivered') {
    const deliveredLabel = input.deliveredAt
      ? `Entregue em ${formatEtaPt(input.deliveredAt)}`
      : 'Entregue';
    if (dispatchAt && days != null) {
      const eta = etaAfterDispatch(dispatchAt, days);
      const met = input.deliveredAt
        ? input.deliveredAt.getTime() <= eta.getTime()
        : null;
      if (met === true) return `${deliveredLabel} · prazo cumprido (até ${formatEtaPt(eta)})`;
      if (met === false) return `${deliveredLabel} · prazo era ${formatEtaPt(eta)}`;
      return `${deliveredLabel} · prazo estimado era ${formatEtaPt(eta)}`;
    }
    return deliveredLabel;
  }

  if (dispatchAt && days != null) {
    const eta = etaAfterDispatch(dispatchAt, days);
    return `Previsão de entrega: ${formatEtaPt(eta)}`;
  }

  if (days != null && (isPreDispatchStatus(input.status) || input.status === 'awaiting_payment')) {
    return formatPrazoDays(days);
  }

  return null;
}

/** Data de entrega a partir do histórico (primeira ocorrência de delivered). */
export function findDeliveredAt(statusHistory: StatusHistoryLike[] | undefined | null): Date | null {
  if (!statusHistory?.length) return null;
  let earliest: Date | null = null;
  for (const h of statusHistory) {
    if (h.toStatus !== 'delivered') continue;
    const at = h.createdAt instanceof Date ? h.createdAt : new Date(h.createdAt);
    if (Number.isNaN(at.getTime())) continue;
    if (!earliest || at.getTime() < earliest.getTime()) earliest = at;
  }
  return earliest;
}
