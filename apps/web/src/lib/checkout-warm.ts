/**
 * Carrinho → checkout sem esperar a rede de novo.
 *
 * O carrinho já tem na tela o carrinho e os endereços que acabou de buscar na API. Ao tocar em
 * "Finalizar", guardamos uma cópia (vale 30 s, uso único). O checkout desenha na hora com ela e
 * já pede o frete; em paralelo busca o carrinho de novo e só troca se mudou. O servidor continua
 * recalculando tudo no pedido; isto só adianta a tela.
 */
export const CHECKOUT_WARM_MAX_AGE_MS = 30_000;

type Warm = { at: number; cart: unknown; addresses: unknown[] | null };
let warm: Warm | null = null;

export function warmCheckout(cart: unknown, addresses: unknown[] | null, now = Date.now()): void {
  if (!cart) return;
  warm = { at: now, cart, addresses };
}

/** One-shot: returns the seed only if fresh, then clears it. */
export function takeCheckoutWarm<C, A>(now = Date.now()): { cart: C; addresses: A[] | null } | null {
  const w = warm;
  warm = null;
  if (!w || now - w.at > CHECKOUT_WARM_MAX_AGE_MS || now < w.at) return null;
  return { cart: w.cart as C, addresses: (w.addresses as A[] | null) ?? null };
}

/** Same JSON → keep the seeded object (no re-render, no second freight quote). */
export function sameCartPayload(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
