import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Response } from 'express';
import { mapMulterUploadError } from '../../modules/uploads/upload-validate';
import { isProdLikeAppEnv } from '../prod-like-env';
import { logServerError } from '../error-log';
import { requestIdOf } from '../request-id';
import { OpsAlertsService } from '../../modules/ops-alerts/ops-alerts.service';
import { sanitizeClientErrorDetails, sanitizeClientErrorMessage } from './sanitize-error';

export type ClientErrorBody = {
  success: false;
  ok: false;
  error: { code: string; message: string; details: unknown[] };
  meta: { requestId: string };
};

/**
 * Build the public error envelope. Never includes stack.
 * In prod-like envs, HTTP ≥500 always gets a generic message (no Prisma/path leaks).
 */
export function buildClientError(
  exception: unknown,
  requestId: string = randomUUID(),
): {
  status: number;
  body: ClientErrorBody;
} {
  const multerMapped = mapMulterUploadError(exception);
  if (multerMapped) {
    return {
      status: HttpStatus.BAD_REQUEST,
      body: {
        success: false,
        ok: false,
        error: { code: multerMapped.code, message: multerMapped.message, details: [] },
        meta: { requestId },
      },
    };
  }

  const isHttp = exception instanceof HttpException;
  const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
  const env = String(process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
  const prodLike = isProdLikeAppEnv();

  let code = 'INTERNAL_ERROR';
  let message = 'Erro interno';
  let details: unknown[] = [];

  if (isHttp) {
    const body = exception.getResponse();
    if (status === 400) code = 'VALIDATION_ERROR';
    if (status === 401) code = 'UNAUTHORIZED';
    if (status === 403) code = 'FORBIDDEN';
    if (status === 404) code = 'NOT_FOUND';
    if (status === 409) code = 'CONFLICT';
    if (status === 429) code = 'RATE_LIMITED';
    if (typeof body === 'string') message = body;
    else if (typeof body === 'object' && body && 'message' in body) {
      const m = (body as { message: string | string[] }).message;
      message = Array.isArray(m) ? m[0] : m;
      details = Array.isArray(m) ? m : [];
    }
    if (typeof body === 'object' && body && 'code' in (body as object)) {
      code = String((body as { code: string }).code);
    }
  } else if (!prodLike && env === 'development' && exception instanceof Error) {
    message = exception.message;
  }

  // Defense-in-depth: never surface internal 5xx text/details/stack in prod/staging
  if (prodLike && status >= 500) {
    message = 'Erro interno';
    details = [];
    if (!isHttp) code = 'INTERNAL_ERROR';
  }

  message = sanitizeClientErrorMessage(message, { prodLike, status });
  details = sanitizeClientErrorDetails(details, { prodLike, status });

  return {
    status,
    body: {
      success: false,
      ok: false,
      error: { code, message, details },
      meta: { requestId },
    },
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Optional() private readonly opsAlerts?: OpsAlertsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      requestId?: string;
      method?: string;
      originalUrl?: string;
      url?: string;
      baseUrl?: string;
      route?: { path?: unknown };
    }>();
    const requestId = requestIdOf(req);
    const { status, body } = buildClientError(exception, requestId);
    if (status >= 500) {
      // H4: 5xx used to leave no trace. One structured line with route + requestId + masked stack.
      const routePath = req?.route && typeof req.route.path === 'string' ? req.route.path : undefined;
      logServerError(exception, {
        requestId,
        status,
        method: req?.method,
        url: req?.originalUrl || req?.url,
        route: routePath ? `${req?.baseUrl || ''}${routePath}` : undefined,
        code: body.error.code,
      });
      this.opsAlerts?.checkSoon();
    }
    res.setHeader('x-request-id', requestId);
    res.status(status).json(body);
  }
}
