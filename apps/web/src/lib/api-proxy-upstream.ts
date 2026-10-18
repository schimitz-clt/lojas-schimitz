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
