import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  authPageModeFromSearch,
  authRegisterHref,
  cartCheckoutHref,
  checkoutAuthHref,
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
assert.ok(entrar.includes('/auth/login'), 'login tab still posts /auth/login');
assert.ok(entrar.includes('saveSession'), 'login and register update sch_user');
const registerFn = entrar.slice(entrar.indexOf('async function submitRegister'), entrar.indexOf('return ('));
assert.equal(registerFn.includes('/auth/login'), false, 'Criar conta does not require a second login');
assert.ok(registerFn.includes('finishLogin'), 'register success follows the login session path');
const signupUi = readFileSync(join(root, 'components/account/CreateAccountFlow.tsx'), 'utf8');
assert.ok(entrar.includes('CreateAccountFlow'), 'entrar register mode is the multi-step flow');
assert.ok(signupUi.includes('Cadastrar e continuar'), 'Portuguese register CTA');
assert.ok(!entrar.includes("localStorage.setItem('sch_access'"), 'no access JWT in storage');
assert.ok(!entrar.includes("localStorage.setItem('sch_refresh'"), 'no refresh JWT in storage');

const cadastro = readFileSync(join(root, 'app/cadastro/page.tsx'), 'utf8');
assert.ok(cadastro.includes('saveSession'), 'standalone cadastro logs the new account in');
assert.ok(cadastro.includes('postRegisterPath'), 'cadastro lands on next or /conta');

const conta = readFileSync(join(root, 'app/conta/page.tsx'), 'utf8');
assert.ok(conta.includes('useSessionUser'), 'Conta hydrates cookie session for Olá');
assert.ok(conta.includes('authRegisterHref'), 'guest Criar conta opens register-on-entrar');

const dados = readFileSync(join(root, 'app/conta/dados/page.tsx'), 'utf8');
assert.ok(dados.includes('useSessionUser'), 'dados waits hydrate before /entrar');

console.log('checkout-auth unit + source tests ok');
