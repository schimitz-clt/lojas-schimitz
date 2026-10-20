/**
 * Checkout → página do pedido sem esperar a rede em série.
 *
 * Assim que o POST /orders responde, o checkout já dispara o GET /orders/:publicId (o mesmo que a
 * página do pedido faria ao montar) e navega. A página do pedido usa essa resposta na 1ª carga se
 * for do mesmo pedido e tiver menos de 10 s (uso único); recargas seguintes (live reload, pagamento)
 * sempre buscam de novo. Não muda pagamento nem pedido: é a mesma leitura, só começa antes.
 */
export const ORDER_WARM_MAX_AGE_MS = 10_000;

type Warm<T> = { id: string; at: number; promise: Promise<T> };
let warm: Warm<unknown> | null = null;

export function warmOrder<T>(id: string, load: () => Promise<T>, now = Date.now()): void {
  if (!id) return;
  const promise = load();
  promise.catch(() => undefined); // sem unhandled rejection se a página não chegar a usar
  warm = { id, at: now, promise };
}

/** One-shot: devolve a leitura antecipada só se for deste pedido e recente; depois limpa. */
export function takeOrderWarm<T>(id: string, now = Date.now()): Promise<T> | null {
  const w = warm;
  warm = null;
  if (!w || w.id !== id || now - w.at > ORDER_WARM_MAX_AGE_MS || now < w.at) return null;
  return w.promise as Promise<T>;
}
