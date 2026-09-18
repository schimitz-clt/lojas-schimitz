/** Shared API JSON envelope (browser fetch). No network. */

export type ApiOk<T> = { ok: true; data: T; meta?: { requestId: string } };
export type ApiFail = { ok: false; error: { code: string; message: string } };

export function parseApiEnvelope<T>(
  text: string,
  httpStatus: number,
  fallbackMessage = 'Erro na API',
): ApiOk<T> | ApiFail {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return {
      ok: false,
      error: {
        code: 'EMPTY_RESPONSE',
        message:
          httpStatus >= 400
            ? `${fallbackMessage} (HTTP ${httpStatus}).`
            : `${fallbackMessage}: resposta vazia do servidor.`,
      },
    };
  }
  try {
    const json = JSON.parse(trimmed) as Partial<ApiOk<T> | ApiFail> & {
      error?: { code?: string; message?: string };
    };
    if (json && typeof json === 'object' && json.ok === true && 'data' in json) {
      return json as ApiOk<T>;
    }
    if (json && typeof json === 'object' && json.ok === false) {
      const message =
        (typeof json.error?.message === 'string' && json.error.message.trim()) || fallbackMessage;
      const code = (typeof json.error?.code === 'string' && json.error.code) || 'API_ERROR';
      return { ok: false, error: { code, message } };
    }
    return {
      ok: false,
      error: {
        code: 'BAD_JSON',
        message: httpStatus >= 400 ? `${fallbackMessage} (HTTP ${httpStatus}).` : fallbackMessage,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: 'NOT_JSON',
        message:
          httpStatus >= 400
            ? `${fallbackMessage} (HTTP ${httpStatus}). A resposta não veio em JSON.`
            : `${fallbackMessage}: não foi possível ler a resposta.`,
      },
    };
  }
}
