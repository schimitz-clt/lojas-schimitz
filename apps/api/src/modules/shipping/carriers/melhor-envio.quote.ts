/**
 * Cotação HTTP Melhor Envio (somente calculate — sem compra de etiqueta).
 *
 * POST {base}/api/v2/me/shipment/calculate
 * Produção: https://www.melhorenvio.com.br
 * Sandbox:  https://sandbox.melhorenvio.com.br
 *
 * Escolha da opção: menor preço viável (custom_price, senão price).
 * Empate: menor prazo. Linhas com `error` (string ou objeto não vazio) ou sem prazo ≥ 1 são ignoradas.
 * `delivery_time` / `custom_delivery_time` são o prazo da transportadora (dias úteis na API).
 * Se esses campos faltam, usa `custom_delivery_range.min` e depois `delivery_range.min`.
 * A vitrine mostra "em X dias" e não inventa data de calendário.
 *
 * A API às vezes devolve um único serviço como objeto (não array de um elemento).
 * Esse objeto é normalizado para `[serviço]` antes da escolha. Objetos de validação
 * (sem id/name/price/company) continuam sem opção.
 * O body sempre manda `services` (PAC, SEDEX, Jadlog .Package, Jadlog .Com, Mini Envios)
 * para a conta devolver várias linhas em array. Sem essa lista, um único serviço
 * habilitado voltava como objeto e a cotação caía em NO_OPTION.
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

export const DEFAULT_MELHOR_ENVIO_USER_AGENT = 'Lojas Schimitz (schimitzclaiton@gmail.com)';

/**
 * Serviços pedidos em toda cotação (IDs oficiais Melhor Envio, sem transportadora extra):
 * 1 PAC, 2 SEDEX, 3 Jadlog .Package, 4 Jadlog .Com, 17 Mini Envios.
 * Mini Envios entra porque o pacote padrão da loja é pequeno (0,3 kg, 16×11×11 cm).
 * Sem `services`, um único serviço da conta volta como objeto e a cotação falha com NO_OPTION.
 */
export const MELHOR_ENVIO_CALCULATE_SERVICES = '1,2,3,4,17';

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
  readonly code: 'HTTP' | 'NO_OPTION' | 'BAD_RESPONSE' | 'INVALID_CEP';
  readonly status: number | null;

  constructor(code: 'HTTP' | 'NO_OPTION' | 'BAD_RESPONSE' | 'INVALID_CEP', message: string, status: number | null = null) {
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

type MelhorEnvioServiceRow = {
  id?: number | string;
  name?: string;
  price?: unknown;
  custom_price?: unknown;
  delivery_time?: unknown;
  custom_delivery_time?: unknown;
  delivery_range?: { min?: unknown; max?: unknown } | null;
  custom_delivery_range?: { min?: unknown; max?: unknown } | null;
  error?: unknown;
  company?: { name?: string } | string | null;
};

/** Linha de serviço (id, name, price ou company). Erro de validação não entra. */
export function isMelhorEnvioServiceRow(payload: unknown): payload is MelhorEnvioServiceRow {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const rec = payload as Record<string, unknown>;
  const hasId = rec.id != null && String(rec.id).trim() !== '';
  const hasName = typeof rec.name === 'string' && rec.name.trim() !== '';
  const hasPrice = rec.price != null || rec.custom_price != null;
  const company = rec.company;
  const hasCompany =
    (typeof company === 'string' && company.trim() !== '') || (!!company && typeof company === 'object');
  return hasId || hasName || hasPrice || hasCompany;
}

/**
 * Array segue array. Um único serviço (objeto) vira lista de um item.
 * Objeto sem cara de serviço (validação) vira lista vazia — o picker devolve null.
 */
export function normalizeMelhorEnvioCalculatePayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isMelhorEnvioServiceRow(payload)) return [payload];
  return [];
}

function serviceRowHasError(error: unknown): boolean {
  if (typeof error === 'string') return error.trim().length > 0;
  if (Array.isArray(error)) return error.some((item) => item != null && String(item).trim() !== '');
  if (error && typeof error === 'object') return Object.keys(error as object).length > 0;
  return false;
}

function rangeMin(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return (raw as { min?: unknown }).min;
}

function companyName(company: MelhorEnvioServiceRow['company']): string {
  if (typeof company === 'string' && company.trim()) return company.trim();
  if (company && typeof company === 'object' && typeof company.name === 'string' && company.name.trim()) {
    return company.name.trim();
  }
  return 'Melhor Envio';
}

/** Menor preço entre serviços sem erro, com preço > 0 e prazo ≥ 1. Empate: menos dias. */
export function pickCheapestMelhorEnvioService(payload: unknown): PickedService | null {
  const rows = normalizeMelhorEnvioCalculatePayload(payload);
  const viable: PickedService[] = [];
  for (const row of rows) {
    if (!isMelhorEnvioServiceRow(row)) continue;
    const rec = row;
    if (serviceRowHasError(rec.error)) continue;
    const price = parseMoney(rec.custom_price) ?? parseMoney(rec.price);
    if (price == null) continue;
    const daysRaw =
      rec.custom_delivery_time ??
      rec.delivery_time ??
      rangeMin(rec.custom_delivery_range) ??
      rangeMin(rec.delivery_range);
    const days = Math.floor(Number(daysRaw));
    if (!Number.isFinite(days) || days < 1) continue;
    viable.push({
      price,
      days,
      serviceId: String(rec.id ?? ''),
      service: String(rec.name || rec.id || 'servico'),
      company: companyName(rec.company),
    });
  }
  viable.sort((a, b) => a.price - b.price || a.days - b.days || a.service.localeCompare(b.service));
  return viable[0] ?? null;
}


/** Detecta CEP de destino inválido na resposta Melhor Envio (HTTP 422 ou corpo de validação). */
export function isMelhorEnvioInvalidDestinationCep(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const rec = payload as Record<string, unknown>;
  const errors = rec.errors;
  const chunks: string[] = [];
  const errorKeys: string[] = [];
  if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
    for (const [key, val] of Object.entries(errors as Record<string, unknown>)) {
      errorKeys.push(key);
      chunks.push(String(key));
      if (Array.isArray(val)) chunks.push(...val.map((v) => String(v)));
      else if (val != null) chunks.push(String(val));
    }
  }
  if (typeof rec.message === 'string') chunks.push(rec.message);
  const blob = chunks.join(' ').toLowerCase();
  if (!blob) return false;
  const keyMentionsCep = errorKeys.some((k) => /postal|cep/i.test(k));
  const textMentionsCep = /postal[_\s-]?code|cep[_\s-]?destino|cep de destino|\bcep\b/.test(blob);
  const invalid = /invalido|inválido|invalid/.test(blob);
  return (keyMentionsCep || textMentionsCep) && invalid;
}

export const MELHOR_ENVIO_INVALID_CEP_MESSAGE =
  'CEP inválido ou não encontrado. Confira os dígitos e tente de novo.';

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
        services: MELHOR_ENVIO_CALCULATE_SERVICES,
      }),
    });
  } catch {
    throw new MelhorEnvioQuoteError('HTTP', 'Melhor Envio request failed', null);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    if (!res.ok) {
      throw new MelhorEnvioQuoteError('HTTP', `Melhor Envio HTTP ${res.status}`, res.status);
    }
    throw new MelhorEnvioQuoteError('BAD_RESPONSE', 'Melhor Envio response was not JSON', res.status);
  }
  if (!res.ok) {
    if (isMelhorEnvioInvalidDestinationCep(json)) {
      throw new MelhorEnvioQuoteError('INVALID_CEP', MELHOR_ENVIO_INVALID_CEP_MESSAGE, res.status);
    }
    throw new MelhorEnvioQuoteError('HTTP', `Melhor Envio HTTP ${res.status}`, res.status);
  }
  if (isMelhorEnvioInvalidDestinationCep(json)) {
    throw new MelhorEnvioQuoteError('INVALID_CEP', MELHOR_ENVIO_INVALID_CEP_MESSAGE, res.status);
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