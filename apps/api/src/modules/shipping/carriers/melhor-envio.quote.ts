/**
 * Cotação HTTP Melhor Envio (somente calculate — sem compra de etiqueta).
 *
 * POST {base}/api/v2/me/shipment/calculate
 * Produção: https://www.melhorenvio.com.br
 * Sandbox:  https://sandbox.melhorenvio.com.br
 *
 * Escolha da opção: menor preço viável (custom_price, senão price).
 * Empate: menor prazo. Linhas com `error` ou sem prazo ≥ 1 são ignoradas.
 * `delivery_time` / `custom_delivery_time` são o prazo da transportadora (dias úteis na API).
 * A vitrine mostra "em X dias" e não inventa data de calendário.
 *
 * Pacote quando o catálogo não traz peso ou medida (explícito, não é taxa de frete):
 * - peso 0,3 kg
 * - 16 × 11 × 11 cm
 * Origem padrão: 91250-000 (warehouse `origin-91250`, Porto Alegre).
 */

export const MELHOR_ENVIO_CALCULATE_PATH = '/api/v2/me/shipment/calculate';
export const MELHOR_ENVIO_PRODUCTION_BASE = 'https://www.melhorenvio.com.br';
export const MELHOR_ENVIO_SANDBOX_BASE = 'https://sandbox.melhorenvio.com.br';

/** CEP do depósito (prefixo 91). Override: MELHOR_ENVIO_ORIGIN_CEP ou SHIPPING_ORIGIN_CEP. */
export const DEFAULT_ORIGIN_CEP = '91250000';

/** Usado só quando o item não tem weightKg > 0. */
export const DEFAULT_PARCEL_WEIGHT_KG = 0.3;
/** Usado só quando falta width/height/length em cm. */
export const DEFAULT_PARCEL_WIDTH_CM = 16;
export const DEFAULT_PARCEL_HEIGHT_CM = 11;
export const DEFAULT_PARCEL_LENGTH_CM = 11;

export const DEFAULT_MELHOR_ENVIO_USER_AGENT = 'Lojas Schimitz (frete@lojasschimitz.com.br)';

export type MelhorEnvioParcelItem = {
  id?: string;
  qty: number;
  /** Peso de uma unidade, em kg. */
  weightKg?: number;
  widthCm?: number;
  heightCm?: number;
  lengthCm?: number;
  /** Valor segurado de uma unidade. Sem isso, reparte o subtotal. */
  insuranceValue?: number;
};

export type MelhorEnvioCalculateInput = {
  toCep: string;
  subtotal: number;
  items?: MelhorEnvioParcelItem[];
  env?: NodeJS.ProcessEnv;
  token: string;
  fetchImpl?: MelhorEnvioFetch;
};

export type MelhorEnvioPickedQuote = {
  price: number;
  days: number;
  serviceId: string;
  service: string;
  company: string;
  assumedPackage: boolean;
  originCep: string;
};

export type MelhorEnvioFetch = (url: string, init?: RequestInit) => Promise<Response>;

export class MelhorEnvioQuoteError extends Error {
  readonly code: 'HTTP' | 'NO_OPTION' | 'BAD_RESPONSE';
  readonly status: number | null;

  constructor(code: 'HTTP' | 'NO_OPTION' | 'BAD_RESPONSE', message: string, status: number | null = null) {
    super(message);
    this.name = 'MelhorEnvioQuoteError';
    this.code = code;
    this.status = status;
  }
}

export function readMelhorEnvioToken(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.MELHOR_ENVIO_TOKEN || env.MELHOR_ENVIO_ACCESS_TOKEN || '').trim();
}

export function resolveMelhorEnvioBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = String(env.MELHOR_ENVIO_BASE_URL || '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;
  const flag = String(env.MELHOR_ENVIO_SANDBOX || '').trim().toLowerCase();
  if (flag === '1' || flag === 'true' || flag === 'yes' || flag === 'sandbox') {
    return MELHOR_ENVIO_SANDBOX_BASE;
  }
  return MELHOR_ENVIO_PRODUCTION_BASE;
}

export function resolveOriginCep(env: NodeJS.ProcessEnv = process.env): string {
  const raw = String(env.MELHOR_ENVIO_ORIGIN_CEP || env.SHIPPING_ORIGIN_CEP || DEFAULT_ORIGIN_CEP);
  const digits = raw.replace(/\D/g, '');
  return digits.length === 8 ? digits : DEFAULT_ORIGIN_CEP;
}

export function resolveMelhorEnvioUserAgent(env: NodeJS.ProcessEnv = process.env): string {
  const custom = String(env.MELHOR_ENVIO_USER_AGENT || '').trim();
  if (custom) return custom.slice(0, 180);
  return DEFAULT_MELHOR_ENVIO_USER_AGENT;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundWeight(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function positiveOr(raw: unknown, fallback: number): { value: number; assumed: boolean } {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(String(raw).replace(',', '.')) : NaN;
  if (Number.isFinite(n) && n > 0) return { value: n, assumed: false };
  return { value: fallback, assumed: true };
}

export function buildMelhorEnvioProducts(input: {
  subtotal: number;
  items?: MelhorEnvioParcelItem[];
}): { products: Record<string, unknown>[]; assumedPackage: boolean } {
  const source = (input.items || []).filter((item) => Math.floor(Number(item.qty) || 0) >= 1);
  const rows = source.length
    ? source
    : [{ id: 'parcela', qty: 1, insuranceValue: Math.max(0, Number(input.subtotal) || 0) }];
  const insurancePool = Math.max(1, roundMoney(Number(input.subtotal) || 0) || 1);
  const share = roundMoney(insurancePool / rows.length);
  let assumedPackage = source.length === 0;

  const products = rows.map((item, index) => {
    const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
    const weight = positiveOr(item.weightKg, DEFAULT_PARCEL_WEIGHT_KG);
    const width = positiveOr(item.widthCm, DEFAULT_PARCEL_WIDTH_CM);
    const height = positiveOr(item.heightCm, DEFAULT_PARCEL_HEIGHT_CM);
    const length = positiveOr(item.lengthCm, DEFAULT_PARCEL_LENGTH_CM);
    if (weight.assumed || width.assumed || height.assumed || length.assumed) assumedPackage = true;
    const insured = positiveOr(item.insuranceValue, share);
    return {
      id: String(item.id || `item-${index + 1}`).slice(0, 40),
      width: Math.max(1, Math.ceil(width.value)),
      height: Math.max(1, Math.ceil(height.value)),
      length: Math.max(1, Math.ceil(length.value)),
      weight: roundWeight(weight.value),
      insurance_value: Math.max(1, roundMoney(insured.value)),
      quantity: qty,
    };
  });

  return { products, assumedPackage };
}

function parseMoney(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return roundMoney(raw);
  if (typeof raw !== 'string') return null;
  const n = Number(raw.trim().replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return roundMoney(n);
}

export type PickedService = {
  price: number;
  days: number;
  serviceId: string;
  service: string;
  company: string;
};

/** Menor preço entre serviços sem erro, com prazo ≥ 1. Empate: menos dias. */
export function pickCheapestMelhorEnvioService(payload: unknown): PickedService | null {
  if (!Array.isArray(payload)) return null;
  const viable: PickedService[] = [];
  for (const row of payload) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as {
      id?: number | string;
      name?: string;
      price?: unknown;
      custom_price?: unknown;
      delivery_time?: unknown;
      custom_delivery_time?: unknown;
      error?: unknown;
      company?: { name?: string };
    };
    if (typeof rec.error === 'string' && rec.error.trim()) continue;
    const price = parseMoney(rec.custom_price) ?? parseMoney(rec.price);
    if (price == null) continue;
    const daysRaw = rec.custom_delivery_time ?? rec.delivery_time;
    const days = Math.floor(Number(daysRaw));
    if (!Number.isFinite(days) || days < 1) continue;
    viable.push({
      price,
      days,
      serviceId: String(rec.id ?? ''),
      service: String(rec.name || rec.id || 'servico'),
      company: String(rec.company?.name || 'Melhor Envio'),
    });
  }
  viable.sort((a, b) => a.price - b.price || a.days - b.days || a.service.localeCompare(b.service));
  return viable[0] ?? null;
}

export async function calculateMelhorEnvioFreight(
  input: MelhorEnvioCalculateInput,
): Promise<MelhorEnvioPickedQuote> {
  const env = input.env ?? process.env;
  const token = input.token.trim();
  if (!token) {
    throw new MelhorEnvioQuoteError('HTTP', 'Melhor Envio token ausente', null);
  }
  const toCep = String(input.toCep || '').replace(/\D/g, '');
  if (toCep.length !== 8) {
    throw new MelhorEnvioQuoteError('BAD_RESPONSE', 'CEP de destino inválido', null);
  }
  const originCep = resolveOriginCep(env);
  const { products, assumedPackage } = buildMelhorEnvioProducts({
    subtotal: input.subtotal,
    items: input.items,
  });
  const url = `${resolveMelhorEnvioBaseUrl(env)}${MELHOR_ENVIO_CALCULATE_PATH}`;
  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': resolveMelhorEnvioUserAgent(env),
      },
      body: JSON.stringify({
        from: { postal_code: originCep },
        to: { postal_code: toCep },
        products,
        options: { receipt: false, own_hand: false },
      }),
    });
  } catch {
    throw new MelhorEnvioQuoteError('HTTP', 'Melhor Envio request failed', null);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new MelhorEnvioQuoteError('HTTP', `Melhor Envio HTTP ${res.status}`, res.status);
  }
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new MelhorEnvioQuoteError('BAD_RESPONSE', 'Melhor Envio response was not JSON', res.status);
  }
  const picked = pickCheapestMelhorEnvioService(json);
  if (!picked) {
    throw new MelhorEnvioQuoteError('NO_OPTION', 'NO_OPTION', res.status);
  }
  return {
    ...picked,
    assumedPackage,
    originCep,
  };
}
