/**
 * H4 — storefront uncaught error reporting (free: goes to our own API → Railway logs as WEB_CLIENT_ERROR).
 * Pure helpers + a tiny sender with per-page-load limits so a render loop cannot flood the API.
 */
import { maskPii } from './redact-pii';

export type ClientErrorKind = 'boundary' | 'global-boundary' | 'onerror' | 'unhandledrejection';

export type ClientErrorPayload = {
  kind: ClientErrorKind;
  message: string;
  errorName?: string;
  stack?: string;
  digest?: string;
  page: string;
  source?: string;
  line?: number;
  column?: number;
  userAgent?: string;
};

export const CLIENT_ERROR_ENDPOINT = '/api/v1/security/client-error';
export const MAX_REPORTS_PER_PAGE = 5;

/** Browser noise that is not our bug (extensions, cross-origin "Script error.", benign RO loop). */
const IGNORE_RE = [
  /^Script error\.?$/i,
  /ResizeObserver loop/i,
  /(chrome|moz|safari)-extension:\/\//i,
  /^Network request failed$/i,
  /Load failed$/i,
  /AbortError/i,
];

export function shouldIgnoreClientError(message: string, source?: string): boolean {
  const m = String(message || '').trim();
  if (!m) return true;
  if (IGNORE_RE.some((re) => re.test(m))) return true;
  if (source && /(chrome|moz|safari)-extension:\/\//i.test(source)) return true;
  return false;
}

function pathOf(href: string | undefined | null): string {
  if (!href) return '/';
  try {
    return new URL(href, 'https://x.invalid').pathname || '/';
  } catch {
    return String(href).split(/[?#]/)[0] || '/';
  }
}

/** Normalize anything thrown into a masked, bounded payload (no query strings, no e-mail/CPF/tokens). */
export function buildClientErrorPayload(
  kind: ClientErrorKind,
  error: unknown,
  ctx: { href?: string; userAgent?: string; digest?: string; source?: string; line?: number; column?: number } = {},
): ClientErrorPayload | null {
  let message = '';
  let errorName: string | undefined;
  let stack: string | undefined;
  if (error instanceof Error) {
    message = error.message;
    errorName = error.name;
    stack = error.stack;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String((error as { message: unknown }).message);
  } else if (error !== undefined) {
    try {
      message = JSON.stringify(error)?.slice(0, 300) || String(error);
    } catch {
      message = String(error);
    }
  }
  if (shouldIgnoreClientError(message, ctx.source)) return null;
  const out: ClientErrorPayload = {
    kind,
    message: maskPii(message, 300),
    page: maskPii(pathOf(ctx.href), 300),
  };
  if (errorName) out.errorName = maskPii(errorName, 80);
  if (stack) out.stack = maskPii(stack.split('\n').slice(0, 15).join('\n'), 2000);
  const digest = (ctx.digest || (error as { digest?: unknown } | null)?.digest) as unknown;
  if (typeof digest === 'string' && digest) out.digest = digest.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  if (ctx.source) out.source = maskPii(pathOf(ctx.source), 300);
  if (Number.isFinite(ctx.line)) out.line = Number(ctx.line);
  if (Number.isFinite(ctx.column)) out.column = Number(ctx.column);
  if (ctx.userAgent) out.userAgent = maskPii(ctx.userAgent, 200);
  return out;
}

/** Per-page-load limiter + dedupe (same kind+message sent once). */
export class ClientErrorLimiter {
  private sent = 0;
  private readonly seen = new Set<string>();
  constructor(private readonly max = MAX_REPORTS_PER_PAGE) {}
  allow(p: ClientErrorPayload): boolean {
    const key = `${p.kind}|${p.message}|${p.page}`;
    if (this.seen.has(key) || this.sent >= this.max) return false;
    this.seen.add(key);
    this.sent++;
    return true;
  }
}

const limiter = new ClientErrorLimiter();

/** Fire-and-forget; never throws, never blocks the UI. */
export function reportClientError(
  kind: ClientErrorKind,
  error: unknown,
  ctx: { digest?: string; source?: string; line?: number; column?: number } = {},
): void {
  try {
    if (typeof window === 'undefined') return;
    const payload = buildClientErrorPayload(kind, error, {
      ...ctx,
      href: window.location?.href,
      userAgent: window.navigator?.userAgent,
    });
    if (!payload || !limiter.allow(payload)) return;
    void fetch(CLIENT_ERROR_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined);
  } catch {
    /* never let reporting break the page */
  }
}
