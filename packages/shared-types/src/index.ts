export type UserRole = 'customer' | 'admin' | 'seller';

export interface ApiOk<T> {
  ok: true;
  data: T;
  meta: { requestId: string };
}

export interface ApiFail {
  ok: false;
  error: { code: string; message: string; details: unknown[] };
}

export type ApiResponse<T> = ApiOk<T> | ApiFail;
