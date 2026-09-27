/**
 * Hosts whose `/api/v1/uploads/**` files the Next image optimizer (`/_next/image`) may fetch.
 * Store's own hosts only — keep in sync with OWN_HOSTS in responsive-image.ts.
 * Anything else (example.com, placehold.co, …) gets 400 from the optimizer.
 */
export const IMAGE_OPTIMIZER_REMOTE_HOSTS = [
  'lojasschimitz.com.br',
  'www.lojasschimitz.com.br',
  'lojas-schimitz-production.up.railway.app',
] as const;
