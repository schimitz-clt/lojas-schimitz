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
 * o upstream responde 502 ou fica pendurado por alguns segundos. GET/HEAD são idempotentes:
 * o proxy tenta de novo com espera crescente, dentro de um orçamento TOTAL de 10 s — cada nova
 * tentativa é abortada no que sobra do orçamento, então a repetição nunca deixa a resposta mais
 * lenta que ~10 s além da 1ª tentativa (a 1ª tentativa não tem timeout: GETs lentos legítimos
 * continuam iguais). A API em si nunca responde 502/504. POST/PUT/PATCH/DELETE (pedido,
 * pagamento) nunca são repetidos aqui.
 */
export const UPSTREAM_RETRY_DELAYS_MS = [500, 1000, 1500, 2000, 2000, 2000, 2000];
export const UPSTREAM_RETRY_BUDGET_MS = 10_000;

export function isRetryableUpstreamMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD';
}

function badGateway(message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: { code: 'BAD_GATEWAY', message } }), {
    status: 502,
    headers: { 'content-type': 'application/json' },
  });
}

export async function fetchUpstreamWithRetry(
  url: string,
  init: RequestInit,
  method: string,
  deps: { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number } = {},
): Promise<Response> {
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;
  if (!isRetryableUpstreamMethod(method)) return doFetch(url, init);

  let last: Response | null = null;
  try {
    last = await doFetch(url, init);
    if (last.status !== 502 && last.status !== 504) return last;
  } catch (err) {
    last = null;
    if (!(err instanceof Error)) throw err;
  }
  const deadline = now() + UPSTREAM_RETRY_BUDGET_MS;
  for (const delay of UPSTREAM_RETRY_DELAYS_MS) {
    if (now() + delay >= deadline) break;
    await last?.body?.cancel().catch(() => undefined);
    await sleep(delay);
    const remaining = deadline - now();
    if (remaining <= 0) break;
    try {
      const res = await doFetch(url, { ...init, signal: AbortSignal.timeout(remaining) });
      if (res.status !== 502 && res.status !== 504) return res;
      last = res;
    } catch {
      // erro de rede / tempo do orçamento esgotado: tenta de novo se ainda houver orçamento.
    }
  }
  return last ?? badGateway('API proxy: upstream indisponível (deploy da API?)');
}
