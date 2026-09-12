import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { mapMulterUploadError } from '../../modules/uploads/upload-validate';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const multerMapped = mapMulterUploadError(exception);
    if (multerMapped) {
      res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        ok: false,
        error: { code: multerMapped.code, message: multerMapped.message, details: [] },
      });
      return;
    }
    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const env = process.env.APP_ENV || process.env.NODE_ENV || 'development';

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
    } else if (env === 'development' && exception instanceof Error) {
      message = exception.message;
    }

    if (isHttp) {
      const body = exception.getResponse();
      if (typeof body === 'object' && body && 'code' in (body as object)) {
        code = String((body as { code: string }).code);
      }
    }

    res.status(status).json({
      success: false,
      ok: false,
      error: { code, message, details },
    });
  }
}
