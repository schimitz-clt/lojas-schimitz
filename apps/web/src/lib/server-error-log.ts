/**
 * H4 — structured line for errors thrown while Next renders/handles a request on the server
 * (used by src/instrumentation.ts onRequestError). Masked; no headers/cookies/query strings.
 */
import { maskPii } from './redact-pii';

export type NextRequestErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
  revalidateReason?: string;
};

export function buildWebServerErrorLine(
  err: unknown,
  request: { path?: string; method?: string },
  context: NextRequestErrorContext = {},
  now = new Date(),
): string {
  const e = err as (Error & { digest?: string }) | undefined;
  const path = String(request?.path || '/').split(/[?#]/)[0] || '/';
  return JSON.stringify({
    level: 'error',
    msg: 'WEB_SERVER_ERROR',
    ts: now.toISOString(),
    method: String(request?.method || '').slice(0, 10) || undefined,
    path: maskPii(path, 300),
    routePath: context.routePath ? maskPii(context.routePath, 200) : undefined,
    routeType: context.routeType,
    renderSource: context.renderSource,
    digest: typeof e?.digest === 'string' ? e.digest.slice(0, 64) : undefined,
    errorName: e instanceof Error ? e.name : typeof err,
    message: maskPii(e instanceof Error ? e.message : String(err), 500),
    stack: e instanceof Error && e.stack ? maskPii(e.stack.split('\n').slice(0, 16).join('\n'), 4000) : undefined,
  });
}
