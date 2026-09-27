import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  authPageModeFromSearch,
  authRegisterHref,
  cartCheckoutHref,
  checkoutAuthHref,
  checkoutServerRedirect,
} from './checkout-auth';
import { loginNextPath } from './order-recovery';

assert.equal(checkoutAuthHref(), loginNextPath('/checkout'));
assert.equal(checkoutAuthHref(), '/entrar?next=%2Fcheckout');
assert.equal(cartCheckoutHref(true), '/checkout');
assert.equal(cartCheckoutHref(false), '/entrar?next=%2Fcheckout');
assert.equal(authRegisterHref('/conta'), '/entrar?next=%2Fconta&cadastro=1');
assert.equal(authRegisterHref('/checkout'), '/entrar?next=%2Fcheckout&cadastro=1');
assert.equal(authPageModeFromSearch(''), 'login');
assert.equal(authPageModeFromSearch('?next=%2Fcheckout'), 'login');
assert.equal(authPageModeFromSearch('?next=%2Fcheckout&cadastro=1'), 'register');
assert.equal(authPageModeFromSearch('cadastro=1'), 'register');

const root = join(__dirname, '..');
const checkout = readFileSync(join(root, 'app/checkout/page.tsx'), 'utf8');
assert.ok(checkout.includes('ensureHydratedSession') || checkout.includes('useSessionUser'), 'checkout waits cookie hydrate');
assert.ok(checkout.includes("loginNextPath('/checkout')"), 'checkout returns to checkout after login');
assert.ok(!checkout.includes("router.push('/entrar')"), 'must not drop next=/checkout');

const cart = readFileSync(join(root, 'app/carrinho/page.tsx'), 'utf8');
assert.ok(cart.includes('cartCheckoutHref'), 'guest cart CTA keeps next=/checkout');
assert.ok(cart.includes('useSessionUser'), 'cart waits cookie hydrate before guest vs logged-in');
assert.ok(cart.includes('getGuestToken'), 'guest can still hold a cart');

const summaryAt = cart.indexOf('className="cart-summary');
const stickyAt = cart.indexOf('className="cart-sticky-checkout"');
assert.ok(summaryAt > 0 && stickyAt > summaryAt, 'summary card sits above the sticky checkout bar');
const summary = cart.slice(summaryAt, stickyAt);
const sticky = cart.slice(stickyAt);
assert.equal(summary.includes('cart-checkout-btn'), false, 'summary card does not repeat Finalizar compra');
assert.ok(summary.includes('Continuar comprando'), 'keep-shopping stays in the summary card');
assert.ok(summary.includes('CartCouponField'), 'coupon field stays in the summary');
assert.ok(sticky.includes('href={checkoutHref}'), 'sticky Finalizar keeps the same checkout href');
assert.ok(sticky.includes('cartCheckoutLabel'), 'sticky Finalizar keeps the same label');
assert.equal((cart.match(/cart-checkout-btn/g) || []).length, 2, 'only the sticky bar renders the checkout CTA');

const entrar = readFileSync(join(root, 'app/entrar/page.tsx'), 'utf8');
assert.ok(entrar.includes('/auth/register'), 'entrar can create account at buy time');
assert.ok(entrar.includes('/auth/login'), 'Entrar still posts /auth/login');
assert.ok(entrar.includes('saveSession'), 'login/register updates sch_user');
const registerFn = entrar.slice(entrar.indexOf('async function submitRegister'), entrar.indexOf('\n  return ('));
assert.ok(registerFn.includes('finishLogin'), 'register at checkout uses the login session path');
assert.equal(registerFn.includes('/auth/login'), false, 'register itself issues the session');
const signupUi = readFileSync(join(root, 'components/account/CreateAccountFlow.tsx'), 'utf8');
assert.ok(entrar.includes('CreateAccountFlow'), 'entrar register mode is the multi-step flow');
assert.ok(signupUi.includes('Cadastrar e continuar'), 'Portuguese register CTA');
assert.ok(!entrar.includes("localStorage.setItem('sch_access'"), 'no access JWT in storage');
assert.ok(!entrar.includes("localStorage.setItem('sch_refresh'"), 'no refresh JWT in storage');

const cadastro = readFileSync(join(root, 'app/cadastro/page.tsx'), 'utf8');
assert.ok(cadastro.includes('saveSession'), 'standalone cadastro stays logged in');
assert.ok(cadastro.includes('window.location.href'), 'cadastro redirects to next or /conta');
assert.equal(cadastro.includes('Entrar para continuar'), false);

const conta = readFileSync(join(root, 'app/conta/page.tsx'), 'utf8');
assert.ok(conta.includes('useSessionUser'), 'Conta hydrates cookie session for Olá');
assert.ok(conta.includes('authRegisterHref'), 'guest Criar conta opens register-on-entrar');

const dados = readFileSync(join(root, 'app/conta/dados/page.tsx'), 'utf8');
assert.ok(dados.includes('useSessionUser'), 'dados waits hydrate before /entrar');


// Fix 3 (Melhoria 6): server-side redirect of logged-out /checkout.
{
  const base = { pathname: '/checkout', search: '', hostname: 'lojasschimitz.com.br', cookieNames: [] as string[] };
  assert.equal(checkoutServerRedirect(base), '/entrar?next=%2Fcheckout', 'no session cookie → /entrar with next');
  assert.equal(checkoutServerRedirect({ ...base, pathname: '/checkout/' }), '/entrar?next=%2Fcheckout', 'trailing slash');
  assert.equal(
    checkoutServerRedirect({ ...base, search: '?cupom=X1' }),
    '/entrar?next=%2Fcheckout%3Fcupom%3DX1',
    'query kept inside next',
  );
  assert.equal(checkoutServerRedirect({ ...base, cookieNames: ['sch_refresh'] }), null, 'refresh cookie → render');
  assert.equal(checkoutServerRedirect({ ...base, cookieNames: ['sch_access'] }), null, 'access cookie → render');
  assert.equal(
    checkoutServerRedirect({ ...base, cookieNames: ['_ga', 'sch_user', 'cart'] }),
    '/entrar?next=%2Fcheckout',
    'unrelated cookies do not count as session',
  );
  assert.equal(checkoutServerRedirect({ ...base, hostname: 'localhost:3000' }), null, 'localhost (memory session) → client check');
  assert.equal(checkoutServerRedirect({ ...base, hostname: '127.0.0.1' }), null, '127.0.0.1 → client check');
  assert.equal(checkoutServerRedirect({ ...base, pathname: '/carrinho' }), null, 'other paths untouched');
  assert.equal(checkoutServerRedirect({ ...base, pathname: '/checkout-promo' }), null, 'prefix paths untouched');

  const mw = readFileSync(join(root, 'middleware.ts'), 'utf8');
  assert.ok(mw.includes('checkoutServerRedirect'), 'middleware uses the checkout guard');
  assert.ok(mw.includes('307'), 'checkout redirect is temporary (307)');
  assert.ok(mw.includes("c.value.trim() !== ''"), 'empty (cleared) cookies are not a session');
  const checkoutPage = readFileSync(join(root, 'app/checkout/page.tsx'), 'utf8');
  assert.ok(checkoutPage.includes("router.replace(loginNextPath('/checkout'))"), 'client fallback redirect kept');
}

console.log('checkout-auth unit + source tests ok');
