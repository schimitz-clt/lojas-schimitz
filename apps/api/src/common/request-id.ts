import { randomUUID } from 'crypto';

const SAFE_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;

/** Accept a caller-provided x-request-id only if it is short and plain; otherwise mint a UUID. */
export function resolveRequestId(header: unknown): string {
  const v = Array.isArray(header) ? header[0] : header;
  if (typeof v === 'string') {
    const t = v.trim();
    if (SAFE_ID_RE.test(t)) return t;
  }
  return randomUUID();
}

type ReqLike = { headers?: Record<string, unknown>; requestId?: string };
type ResLike = { setHeader(name: string, value: string): unknown };

/**
 * Express middleware: every request gets req.requestId and an `x-request-id` response header,
 * so a customer-visible error id can be found in Railway logs (HTTP_5XX lines carry the same id).
 */
export function requestIdMiddleware(req: ReqLike, res: ResLike, next: () => void) {
  const id = resolveRequestId(req.headers?.['x-request-id']);
  req.requestId = id;
  try {
    res.setHeader('x-request-id', id);
  } catch {
    /* headers already sent — ignore */
  }
  next();
}

/** Read the id assigned by the middleware (or resolve from header when middleware did not run). */
export function requestIdOf(req: ReqLike | undefined | null): string {
  if (req && typeof req.requestId === 'string' && req.requestId) return req.requestId;
  return resolveRequestId(req?.headers?.['x-request-id']);
}
