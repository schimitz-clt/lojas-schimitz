/**
 * Rastreio manual (etiqueta comprada fora do sistema). Sem chamada a transportadora.
 */
export const TRACKING_EDITABLE_STATUSES = ['in_transit', 'shipped', 'delivered'] as const;
export const TRACKING_CODE_RE = /^[A-Z0-9-]{4,40}$/;

/** Maiúsculas, sem espaços. null quando vazio ou fora do formato. */
export function normalizeTrackingCode(raw: unknown): string | null {
  const v = String(raw ?? '')
    .replace(/\s+/g, '')
    .toUpperCase();
  return TRACKING_CODE_RE.test(v) ? v : null;
}

export function normalizeCarrier(raw: unknown): string | null {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 40);
  return v || null;
}

const CARRIER_LABELS: Record<string, string> = {
  propria: 'Entrega própria',
  correios: 'Correios',
  melhor_envio: 'Melhor Envio',
  jadlog: 'Jadlog',
  loggi: 'Loggi',
  azul_cargo: 'Azul Cargo',
  jet: 'J&T Express',
};

export function carrierLabel(carrier: string | null | undefined): string | null {
  const k = normalizeCarrier(carrier);
  if (!k) return null;
  return CARRIER_LABELS[k] ?? k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function isTrackingEditableStatus(status: string): boolean {
  return (TRACKING_EDITABLE_STATUSES as readonly string[]).includes(status);
}

/** Texto curto para in-app / e-mail. */
export function trackingSentence(code: string, carrier?: string | null): string {
  const label = carrierLabel(carrier);
  return label && label !== 'Entrega própria'
    ? `Código de rastreio (${label}): ${code}.`
    : `Código de rastreio: ${code}.`;
}
