/**
 * Defesa CSRF por Origin para requisições autenticadas SÓ por cookie (sch_access / sch_refresh).
 *
 * Contexto: em produção o cookie pode sair com SameSite=None (acesso direto à API). Sem checagem,
 * um site de terceiros poderia disparar um POST/PATCH/DELETE "às cegas" com o cookie do admin
 * (ex.: estorno legado, que não exige corpo). CORS não impede o efeito colateral.
 *
 * Regra (só métodos que alteram dados, só quando há cookie de sessão e NÃO há Authorization: Bearer):
 *  - Sec-Fetch-Site: same-origin            → permite (cabeçalho que o navegador não deixa o site forjar)
 *  - Origin na lista conhecida / mesmo host → permite
 *  - sem Origin e sem Referer               → bloqueia (403 CSRF_ORIGIN, motivo missing_origin), EXCETO
 *    nas rotas servidor-a-servidor/nativas de CSRF_EXEMPT_PATHS (webhooks do Mercado Pago, registro de
 *    token push do app Android, relatórios CSP/erros do navegador). Navegadores e o WebView sempre mandam
 *    Origin em POST/PATCH/DELETE via fetch; quem não manda é cliente não-navegador, que deve usar Bearer.
 *  - qualquer outro Origin (ou "null")      → bloqueia com 403 CSRF_ORIGIN
 * CSRF_ORIGIN_CHECK=report só registra (não bloqueia); =off desliga (rollback).
 */
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '../modules/auth/refresh-cookie';
import { structuredLog } from './structured-log';

export type CsrfMode = 'enforce' | 'report' | 'off';

export type CsrfReqLike = {
  method?: string;
  path?: string;
  originalUrl?: string;
  headers: Record<string, string | string[] | undefined>;
};

export type CsrfDecision = { allow: true; reason: string } | { allow: false; reason: string };

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Rotas que recebem POST sem Origin legitimamente (não são navegador) e por isso ficam fora
 * da regra "sem Origin → bloqueia". Comparação pelo fim do caminho (independe do prefixo api/v1).
 *  - /webhooks/*      Mercado Pago (servidor → servidor, assinatura HMAC própria)
 *  - /push/tokens     app Android: PushRegistration.kt posta com HttpURLConnection + cookie do WebView, sem Origin
 *  - /security/*      relatórios CSP / erros de cliente (o navegador manda sem Origin às vezes)
 * Cron/agendador roda dentro do processo (sem HTTP), então não passa por aqui.
 */
const CSRF_MISSING_ORIGIN_EXEMPT: RegExp[] = [
  /\/webhooks(\/|$)/,
  /\/push\/tokens$/,
  /\/security\//,
  /\/csp-report$/,
];

export function isMissingOriginExempt(path: string): boolean {
  const p = String(path || '').split('?')[0].replace(/\/+$/, '').toLowerCase();
  return CSRF_MISSING_ORIGIN_EXEMPT.some((re) => re.test(p));
}

export function resolveCsrfMode(env: NodeJS.ProcessEnv = process.env): CsrfMode {
  const v = String(env.CSRF_ORIGIN_CHECK || '').toLowerCase().trim();
  if (v === 'off' || v === 'false' || v === '0') return 'off';
  if (v === 'report') return 'report';
  return 'enforce';
}

function header(req: CsrfReqLike, name: string): string {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v || '').toString().trim();
}

function originOf(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.origin.toLowerCase();
  } catch {
    return null;
  }
}

function withWwwVariants(origin: string): string[] {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    const alt = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    const port = u.port ? `:${u.port}` : '';
    return [u.origin.toLowerCase(), `${u.protocol}//${alt}${port}`];
  } catch {
    return [];
  }
}

export function allowedOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const raw = [
    ...(env.CORS_ORIGINS || '').split(','),
    env.NEXT_PUBLIC_SITE_URL,
    env.PUBLIC_WEB_URL,
    env.SITE_URL,
    env.APP_URL,
  ];
  const out = new Set<string>();
  for (const r of raw) {
    const o = r ? originOf(String(r).trim()) : null;
    if (o) for (const v of withWwwVariants(o)) out.add(v);
  }
  return out;
}

export function hasSessionCookie(cookieHeader: string): boolean {
  if (!cookieHeader) return false;
  const names = new Set([ACCESS_COOKIE_NAME(), REFRESH_COOKIE_NAME()]);
  return cookieHeader.split(';').some((p) => {
    const i = p.indexOf('=');
    if (i < 0) return false;
    return names.has(p.slice(0, i).trim()) && p.slice(i + 1).trim() !== '';
  });
}

export function evaluateCsrfOrigin(req: CsrfReqLike, env: NodeJS.ProcessEnv = process.env): CsrfDecision {
  const method = String(req.method || 'GET').toUpperCase();
  if (SAFE_METHODS.has(method)) return { allow: true, reason: 'safe_method' };

  const auth = header(req, 'authorization');
  if (/^Bearer\s+\S+/i.test(auth)) return { allow: true, reason: 'bearer_auth' };
  if (!hasSessionCookie(header(req, 'cookie'))) return { allow: true, reason: 'no_session_cookie' };

  const fetchSite = header(req, 'sec-fetch-site').toLowerCase();
  if (fetchSite === 'same-origin') return { allow: true, reason: 'sec_fetch_same_origin' };

  const originHeader = header(req, 'origin');
  const referer = header(req, 'referer');
  const claimed = originHeader || (referer ? originOf(referer) || referer : '');

  if (!claimed) {
    if (fetchSite === 'cross-site') return { allow: false, reason: 'cross_site_without_origin' };
    if (isMissingOriginExempt(String(req.originalUrl || req.path || ''))) {
      return { allow: true, reason: 'no_origin_exempt_path' };
    }
    return { allow: false, reason: 'missing_origin' };
  }

  const origin = originOf(claimed);
  if (!origin) return { allow: false, reason: 'origin_invalid' };

  if (allowedOrigins(env).has(origin)) return { allow: true, reason: 'origin_allowlisted' };

  // Mesmo host que a requisição (proxy same-origin do Next repassa x-forwarded-host).
  const hosts = [header(req, 'x-forwarded-host'), header(req, 'host')]
    .map((h) => h.split(',')[0].trim().toLowerCase())
    .filter(Boolean);
  try {
    if (hosts.includes(new URL(origin).host.toLowerCase())) return { allow: true, reason: 'origin_matches_host' };
  } catch {
    /* ignore */
  }
  return { allow: false, reason: 'origin_foreign' };
}

type Res = {
  status: (n: number) => Res;
  json: (b: unknown) => unknown;
};

export function csrfOriginMiddleware(req: CsrfReqLike, res: Res, next: () => void) {
  const mode = resolveCsrfMode();
  if (mode === 'off') return next();
  const decision = evaluateCsrfOrigin(req);
  if (decision.allow) return next();
  const sample = {
    method: req.method,
    path: String(req.originalUrl || req.path || '').split('?')[0].slice(0, 120),
    reason: decision.reason,
    origin: header(req, 'origin').slice(0, 120) || undefined,
    secFetchSite: header(req, 'sec-fetch-site') || undefined,
  };
  if (mode === 'report') {
    structuredLog('warn', 'CSRF_ORIGIN_WOULD_BLOCK', sample);
    return next();
  }
  structuredLog('warn', 'CSRF_ORIGIN_BLOCKED', sample);
  res.status(403).json({
    ok: false,
    error: {
      code: 'CSRF_ORIGIN',
      message: 'Requisição bloqueada por segurança (origem não reconhecida). Recarregue a página e tente de novo.',
      details: [],
    },
  });
}
