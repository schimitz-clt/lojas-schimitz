/**
 * Server-only half of the API proxy (route handler). Kept out of `api-proxy.ts` because
 * `api.ts` imports that file in the browser: `Buffer` here made webpack ship the Node
 * buffer polyfill (~7 KB gzip) to every storefront page.
 */
/**
 * Node/undici fetch through the App Router proxy.
 * Multipart POST must send a buffered body + duplex: 'half' (undici).
 */
export function buildProxyUpstreamInit(
  method: string,
  headers: Headers,
  body: ArrayBuffer | null | undefined,
): RequestInit {
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    redirect: 'manual',
    cache: 'no-store',
  };
  if (body && body.byteLength > 0) {
    init.body = Buffer.from(body);
    init.duplex = 'half';
  }
  return init;
}

/**
 * Durante o deploy da API (serviço com volume: o Railway não consegue sobrepor versões),
 * o edge responde 502 por ~5 s. GET/HEAD são idempotentes: o proxy tenta de novo com
 * espera crescente (até ~11 s no total), e a loja vê uma resposta mais lenta em vez de erro.
 * A API em si nunca responde 502/504. POST/PUT/PATCH/DELETE (pedido, pagamento) nunca são
 * repetidos aqui.
 */
export const UPSTREAM_RETRY_DELAYS_MS = [500, 1000, 1500, 2000, 2000, 2000, 2000];

export function isRetryableUpstreamMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD';
}

export async function fetchUpstreamWithRetry(
  url: string,
  init: RequestInit,
  method: string,
  deps: { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {},
): Promise<Response> {
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  if (!isRetryableUpstreamMethod(method)) return doFetch(url, init);
  for (let attempt = 0; ; attempt++) {
    const last = attempt >= UPSTREAM_RETRY_DELAYS_MS.length;
    try {
      const res = await doFetch(url, init);
      if ((res.status !== 502 && res.status !== 504) || last) return res;
      await res.body?.cancel().catch(() => undefined);
    } catch (err) {
      if (last) throw err;
    }
    await sleep(UPSTREAM_RETRY_DELAYS_MS[attempt]);
  }
}
