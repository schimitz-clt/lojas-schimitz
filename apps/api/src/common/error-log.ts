import { HttpException } from '@nestjs/common';
import { maskPii, pathOnly, safeStack } from './redact-pii';
import { opsSignals } from './sliding-window';
import { structuredLog } from './structured-log';

export type ServerErrorContext = {
  requestId: string;
  status: number;
  method?: string;
  url?: string;
  /** Express route pattern when matched, e.g. /api/v1/orders/:id */
  route?: string;
  code?: string;
};

/**
 * Build the log fields for a 5xx. Never includes: headers, cookies, body, query string,
 * user e-mail/CPF (masked if they appear inside messages/stacks).
 */
export function buildServerErrorLogFields(exception: unknown, ctx: ServerErrorContext) {
  const isErr = exception instanceof Error;
  const errorName = isErr ? exception.constructor?.name || exception.name : typeof exception;
  let message: string;
  if (exception instanceof HttpException) {
    const r = exception.getResponse();
    message = typeof r === 'string' ? r : (r as { message?: unknown })?.message != null
      ? String((r as { message?: unknown }).message)
      : exception.message;
  } else if (isErr) {
    message = exception.message;
  } else {
    message = String(exception);
  }
  const prismaCode =
    exception && typeof exception === 'object' && typeof (exception as { code?: unknown }).code === 'string'
      ? String((exception as { code: string }).code).slice(0, 40)
      : undefined;
  return {
    requestId: ctx.requestId,
    status: ctx.status,
    method: ctx.method ? String(ctx.method).slice(0, 10) : undefined,
    path: pathOnly(ctx.url),
    route: ctx.route ? maskPii(ctx.route, 200) : undefined,
    code: ctx.code,
    errorName: maskPii(errorName, 100),
    errorCode: prismaCode,
    message: maskPii(message, 500),
    stack: safeStack(exception),
  };
}

/** Log one server error line (`HTTP_5XX`) and count it for burst alerts. */
export function logServerError(exception: unknown, ctx: ServerErrorContext) {
  try {
    opsSignals.record('http_5xx');
    structuredLog('error', 'HTTP_5XX', buildServerErrorLogFields(exception, ctx));
  } catch {
    // logging must never break the error response
  }
}

/** Process-level crash/rejection line (`UNHANDLED_REJECTION` / `UNCAUGHT_EXCEPTION`). */
export function logProcessError(kind: 'UNHANDLED_REJECTION' | 'UNCAUGHT_EXCEPTION', err: unknown) {
  try {
    structuredLog('error', kind, {
      errorName: err instanceof Error ? err.name : typeof err,
      message: maskPii(err instanceof Error ? err.message : String(err), 500),
      stack: safeStack(err),
    });
  } catch {
    /* ignore */
  }
}
