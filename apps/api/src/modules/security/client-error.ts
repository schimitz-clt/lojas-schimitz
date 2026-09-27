/**
 * Storefront client error report sanitizer (H4). Input is attacker-controllable:
 * everything is clipped, PII/secrets masked, URLs reduced to path (no query/fragment).
 */
import { maskPii, pathOnly } from '../../common/redact-pii';

export type ClientErrorReport = {
  kind: 'boundary' | 'global-boundary' | 'onerror' | 'unhandledrejection';
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

const KINDS = new Set(['boundary', 'global-boundary', 'onerror', 'unhandledrejection']);

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pageOf(v: unknown): string {
  const raw = str(v);
  if (!raw) return '/';
  try {
    const u = new URL(raw, 'https://x.invalid');
    return pathOnly(u.pathname);
  } catch {
    return pathOnly(raw);
  }
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number.NaN;
  return Number.isFinite(n) && n >= 0 && n < 1e7 ? Math.floor(n) : undefined;
}

/** Returns null for junk (no message) so we don't log noise. */
export function summarizeClientError(body: unknown): ClientErrorReport | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const message = maskPii(str(b.message), 300).trim();
  if (!message) return null;
  const kindRaw = str(b.kind);
  const kind = (KINDS.has(kindRaw) ? kindRaw : 'onerror') as ClientErrorReport['kind'];
  const out: ClientErrorReport = { kind, message, page: pageOf(b.page) };
  const name = maskPii(str(b.errorName), 80).trim();
  if (name) out.errorName = name;
  const stack = maskPii(str(b.stack), 2000).trim();
  if (stack) out.stack = stack;
  const digest = str(b.digest).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  if (digest) out.digest = digest;
  const source = str(b.source) ? pageOf(b.source) : '';
  if (source) out.source = source;
  const line = num(b.line);
  if (line !== undefined) out.line = line;
  const column = num(b.column);
  if (column !== undefined) out.column = column;
  const ua = maskPii(str(b.userAgent), 200).trim();
  if (ua) out.userAgent = ua;
  return out;
}
