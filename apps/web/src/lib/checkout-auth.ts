import { loginNextPath } from './order-recovery';

/** Cart/checkout guest CTA — login or register, then return to checkout. */
export function checkoutAuthHref(): string {
  return loginNextPath('/checkout');
}

/** Open /entrar already on the cadastro form, preserving `next`. */
export function authRegisterHref(nextPath: string): string {
  const base = loginNextPath(nextPath);
  return `${base}${base.includes('?') ? '&' : '?'}cadastro=1`;
}

export function authPageModeFromSearch(search: string): 'login' | 'register' {
  const raw = String(search || '');
  const q = raw.startsWith('?') ? raw.slice(1) : raw;
  try {
    const params = new URLSearchParams(q);
    if (params.get('cadastro') === '1') return 'register';
  } catch {
    /* ignore */
  }
  return 'login';
}

export function cartCheckoutHref(loggedIn: boolean): string {
  return loggedIn ? '/checkout' : checkoutAuthHref();
}
