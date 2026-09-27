/**
 * Next.js instrumentation hook (App Router). H4: every server-side render/route error becomes one
 * masked JSON line (WEB_SERVER_ERROR) in the Railway logs of lojas-schimitz-web.
 */
import { buildWebServerErrorLine, type NextRequestErrorContext } from './lib/server-error-log';

export function register() {
  /* nothing to initialise — kept for Next's instrumentation contract */
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: NextRequestErrorContext,
) {
  try {
    // eslint-disable-next-line no-console
    console.error(buildWebServerErrorLine(err, request, context));
  } catch {
    /* never throw from the error hook */
  }
}
