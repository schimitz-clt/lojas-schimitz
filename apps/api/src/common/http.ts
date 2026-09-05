import { randomUUID } from 'crypto';

export function ok<T>(data: T, requestId = randomUUID()) {
  return { success: true as const, ok: true as const, data, meta: { requestId } };
}

export function fail(code: string, message: string, details: unknown[] = [], requestId = randomUUID()) {
  return { ok: false as const, error: { code, message, details }, meta: { requestId } };
}
