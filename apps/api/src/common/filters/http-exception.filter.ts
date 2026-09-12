import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { mapMulterUploadError } from '../../modules/uploads/upload-validate';
import { isProdLikeAppEnv } from '../swagger';

export type ClientErrorBody = {
  success: false;
  ok: false;
  error: { code: string; message: string; details: unknown[] };
};

/**
 * Build the public error envelope. Never includes stack.
 * In prod-like envs, HTTP ≥500 always gets a generic message (no Prisma/path leaks).
 */
export function buildClientError(exception: unknown): {
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

  return {
    status,
    body: {
      success: false,
      ok: false,
      error: { code, message, details },
    },
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const { status, body } = buildClientError(exception);
    res.status(status).json(body);
  }
}
