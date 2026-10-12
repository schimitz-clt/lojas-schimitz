/**
 * Auditoria de ações administrativas (quem fez o quê).
 * Funções puras: saneamento do corpo da requisição e montagem do registro. Sem I/O.
 */

const SENSITIVE_KEY_RE =
  /pass(word|wd)?|senha|token|secret|authorization|cookie|cvv|cvc|card(number|_number)?$|cpf|cnpj|api[-_]?key|private/i;

const MAX_STRING = 200;
const MAX_ARRAY = 20;
const MAX_KEYS = 40;
const MAX_DEPTH = 4;

/** Campos que carregam arquivos/planilhas inteiras: só registramos o tamanho. */
const BULK_KEYS = new Set(['csv', 'xlsx', 'file', 'base64', 'data', 'buffer']);

export function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…(+${value.length - MAX_STRING})` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= MAX_DEPTH) return '[profundo demais]';
  if (Array.isArray(value)) {
    const head = value.slice(0, MAX_ARRAY).map((v) => sanitizeAuditValue(v, depth + 1));
    return value.length > MAX_ARRAY ? [...head, `…(+${value.length - MAX_ARRAY} itens)`] : head;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>);
    for (const [k, v] of entries.slice(0, MAX_KEYS)) {
      if (SENSITIVE_KEY_RE.test(k)) {
        out[k] = '[omitido]';
      } else if (BULK_KEYS.has(k.toLowerCase()) && typeof v === 'string') {
        out[k] = `[${v.length} caracteres]`;
      } else {
        out[k] = sanitizeAuditValue(v, depth + 1);
      }
    }
    if (entries.length > MAX_KEYS) out['…'] = `+${entries.length - MAX_KEYS} campos`;
    return out;
  }
  return String(value);
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isMutatingMethod(method: unknown): boolean {
  return typeof method === 'string' && MUTATING.has(method.toUpperCase());
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Caminho sem querystring e sem ids, ex.: /api/v1/admin/products/:id */
export function normalizeAuditPath(routePath: unknown, rawPath: unknown): string {
  const base = typeof routePath === 'string' && routePath ? routePath : String(rawPath ?? '');
  return base.split('?')[0].replace(UUID_RE, ':id').slice(0, 200);
}

export type AdminAuditRequestLike = {
  method?: string;
  originalUrl?: string;
  url?: string;
  route?: { path?: string };
  params?: Record<string, unknown>;
  body?: unknown;
  ip?: string;
  requestId?: string;
  headers?: Record<string, unknown>;
  user?: { sub?: string; role?: string };
};

export type AdminAuditRecord = {
  action: string;
  actorId?: string;
  entity: string;
  entityId?: string;
  meta: Record<string, unknown>;
};

/** Primeiro segmento depois de /admin/ vira a "entidade" (products, orders, coupons…). */
export function entityFromPath(path: string): string {
  const m = path.match(/\/admin\/([a-z0-9-]+)/i);
  return m ? m[1] : 'admin';
}

export function buildAdminAuditRecord(
  req: AdminAuditRequestLike,
  outcome: { ok: true } | { ok: false; status: number },
): AdminAuditRecord | null {
  if (!isMutatingMethod(req.method)) return null;
  const method = String(req.method).toUpperCase();
  const path = normalizeAuditPath(req.route?.path, (req.originalUrl || req.url || '').split('?')[0]);
  const params = (req.params || {}) as Record<string, unknown>;
  const entityId = typeof params.id === 'string' ? params.id.slice(0, 64) : undefined;
  const ua = req.headers?.['user-agent'];
  return {
    action: `admin.http.${method} ${path}`.slice(0, 200),
    actorId: req.user?.sub,
    entity: entityFromPath(path),
    entityId,
    meta: {
      method,
      path,
      params: sanitizeAuditValue(params),
      body: sanitizeAuditValue(req.body),
      outcome: outcome.ok ? 'ok' : 'error',
      ...(outcome.ok ? {} : { status: outcome.status }),
      ip: req.ip,
      userAgent: typeof ua === 'string' ? ua.slice(0, 160) : undefined,
      requestId: req.requestId,
    },
  };
}
