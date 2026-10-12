/**
 * E2E da JORNADA DE COMPRA (navegador + API real + Postgres local + Mercado Pago FALSO).
 * Complementa storefront-pix.browser.e2e.ts (caminho feliz PIX) com os cenários de borda da jornada:
 * clique duplo, estoque que acaba, pedido pendente após recarregar o checkout, cartão recusado/aprovado
 * (Card Brick substituído por um stub local), webhooks repetidos/fora de ordem, CEP inválido,
 * acesso a pedido de outro cliente, prazo da reserva, itens perdidos no login e layout mobile.
 *
 * Segurança: DATABASE_URL tem de ser local; MP real nunca é chamado (FINANCE_TEST_MODE + servidor falso);
 * o SDK do Mercado Pago no navegador é interceptado e trocado por um stub. Nenhuma cobrança real.
 *
 * Pré-requisitos: build do web com NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=TEST-fake-public-key-local
 * (o Brick só aparece com public key), DATABASE_URL local migrado, playwright-core resolvível.
 * Uso: npm run test:e2e:journey (em apps/api). Saída: PASS/FAIL por cenário + JSON em E2E_ARTIFACTS_DIR.
 */
import assert from 'assert';
import { spawn, type ChildProcess } from 'child_process';
import { createHmac, randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { FakeMercadoPagoServer } from './testing/fake-mercadopago.server';
import { bootHttpApp, compileApi } from './testing/compiled-app';

const WEB_DIR = resolve(__dirname, '../../../../web');
const WEB_PORT = 3000;
const API_PORT = 3001;
const WEB = `http://localhost:${WEB_PORT}`;
const WEBHOOK_SECRET = 'fake-local-browser-e2e-webhook-secret-0123';
const ART = process.env.E2E_ARTIFACTS_DIR || '/tmp/storefront-journey-e2e';
const REAL_MP_ENV = ['MERCADO_PAGO_ACCESS_TOKEN', 'MP_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET', 'MP_WEBHOOK_SECRET', 'STAGING_MP_ACCESS_TOKEN', 'STAGING_MP_CLIENT_SECRET', 'PROD_MP_MARKETPLACE_CLIENT_SECRET', 'MERCADO_PAGO_PUBLIC_KEY', 'MERCADO_PAGO_USER_ID', 'PUBLIC_API_URL'];
const PASSWORD = 'Browser-e2e-Pass-123';
let ipSeq = 10;
const nextIp = () => `10.20.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;

/** Stub do SDK do Mercado Pago: renderiza um botão que dispara onSubmit com um token falso. */
const MP_SDK_STUB = `
window.MercadoPago = function () {
  return { bricks: function () { return { create: async function (name, id, settings) {
    var c = document.getElementById(id);
    c.innerHTML = '<button id="stub-brick-pay" type="button">Pagar (stub)</button>';
    c.querySelector('button').onclick = function () {
      settings.callbacks.onSubmit({ token: 'tok_' + Math.random().toString(36).slice(2, 14), installments: 1, payment_method_id: 'visa' }).catch(function () {});
    };
    setTimeout(function () { if (settings.callbacks.onReady) settings.callbacks.onReady(); }, 10);
    return { unmount: function () {} };
  } }; } };
};`;

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url || /railway|rlwy|\.internal|prod/i.test(url) || !/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: DATABASE_URL deve ser local');
}

async function waitHttp(url: string, ms: number) {
  const until = Date.now() + ms;
  for (;;) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch { /* not up yet */ }
    if (Date.now() > until) throw new Error(`timeout esperando ${url}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function waitFor(fn: () => Promise<boolean>, what: string, ms = 15_000) {
  const until = Date.now() + ms;
  for (;;) {
    if (await fn().catch(() => false)) return;
    if (Date.now() > until) throw new Error(`timeout: ${what}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

function startWeb(): ChildProcess {
  assert.ok(existsSync(join(WEB_DIR, '.next', 'BUILD_ID')), 'apps/web sem build (.next/BUILD_ID)');
  const child = spawn('npx', ['next', 'start', '-p', String(WEB_PORT)], {
    cwd: WEB_DIR,
    env: { ...process.env, PORT: String(WEB_PORT), API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  child.stderr?.on('data', (d) => process.env.E2E_VERBOSE && process.stdout.write(`[web:err] ${d}`));
  return child;
}

type Result = { id: string; name: string; status: 'PASS' | 'FAIL'; detail?: string };

async function main() {
  assertLocalDb();
  mkdirSync(ART, { recursive: true });
  for (const k of REAL_MP_ENV) delete process.env[k];
  const fake = new FakeMercadoPagoServer();
  await fake.start();
  Object.assign(process.env, {
    APP_ENV: 'development', NODE_ENV: 'development', PAYMENTS_PROVIDER: 'mercadopago',
    MERCADO_PAGO_ACCESS_TOKEN: 'TEST-FAKE-LOCAL', MERCADO_PAGO_WEBHOOK_SECRET: WEBHOOK_SECRET, MERCADO_PAGO_API_BASE_URL: fake.baseUrl,
    MERCADO_PAGO_PUBLIC_KEY: 'TEST-fake-public-key-local',
    FINANCE_TEST_MODE: 'true', FINANCE_RECONCILIATION_CRON_ENABLED: 'false',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'browser-e2e-access-secret-xxxxxxxxxx',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'browser-e2e-refresh-secret-xxxxxxxxx',
    REFRESH_COOKIE_SECURE: 'false',
  });
  console.log(`[${fake.label}] ${fake.baseUrl}`);
  compileApi();
  const srv = await bootHttpApp(API_PORT);
  const prisma = new PrismaClient({ log: ['error'] });
  const web = startWeb();
  const results: Result[] = [];
  let browser: any;
  const passwordHash = await argon2.hash(PASSWORD);
  try {
    await waitHttp(`${WEB}/`, 60_000);
    const seller = await prisma.seller.upsert({ where: { slug: 'lojas-schimitz' }, update: {}, create: { id: '00000000-0000-4000-8000-000000000001', name: 'Lojas Schimitz', slug: 'lojas-schimitz', status: 'active' } });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { chromium } = require('playwright-core');
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });

    // ---------- helpers de cenário ----------
    const mkProduct = (qtyOnHand: number, price = 100) => {
      const sku = `JRN-${randomUUID().slice(0, 8)}`;
      return prisma.product.create({ data: { sku, name: `Produto Jornada ${sku}`, slug: sku.toLowerCase(), description: 'produto sintético da jornada', price, active: true, sellerId: seller.id, inventory: { create: { qtyOnHand, qtyReserved: 0 } } } });
    };
    const mkUser = async (withAddress = true) => {
      const email = `jrn-${randomUUID().slice(0, 8)}@test.local`;
      const user = await prisma.user.create({ data: { email, passwordHash, name: 'Cliente Jornada', role: 'customer', status: 'active', phone: '51999999999' } });
      if (withAddress) await prisma.address.create({ data: { userId: user.id, label: 'Casa', cep: '91250000', street: 'Rua Teste', number: '1', district: 'Centro', city: 'Porto Alegre', uf: 'RS', isDefault: true } });
      return user;
    };
    const seedCart = async (userId: string, productId: string, qty: number) => {
      const cart = (await prisma.cart.findFirst({ where: { userId } })) || (await prisma.cart.create({ data: { userId } }));
      await prisma.cartItem.create({ data: { cartId: cart.id, productId, qty } });
    };
    const newPage = async (opts: { mobile?: boolean; stubBrick?: boolean } = {}) => {
      // IP de cliente próprio por contexto (X-Forwarded-For, trust proxy=1): o limite de login por IP (8/min) é
      // proteção de produção e continua ligado; o teste só evita que 15 cenários dividam o mesmo IP.
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': nextIp() }, bypassCSP: true, locale: 'pt-BR', viewport: opts.mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: !!opts.mobile });
      if (opts.stubBrick) await ctx.route('https://sdk.mercadopago.com/js/v2', (r: any) => r.fulfill({ status: 200, contentType: 'application/javascript', body: MP_SDK_STUB }));
      const page = await ctx.newPage();
      page.setDefaultTimeout(15_000);
      const errors: string[] = [];
      page.on('pageerror', (e: Error) => errors.push(String(e)));
      return { ctx, page, errors };
    };
    const loginUI = async (page: any, email: string, next = '/carrinho') => {
      await page.goto(`${WEB}/entrar?next=${encodeURIComponent(next)}`);
      await page.fill('#signup-email', email);
      await page.click('button.acct-cta');
      await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
      await page.click('button.acct-cta');
      await page.waitForURL((u: URL) => u.pathname === next);
    };
    const checkoutOrder = async (page: any) => {
      await page.goto(`${WEB}/checkout`);
      const confirm = page.getByRole('button', { name: 'Confirmar pedido e pagar' });
      await waitFor(async () => confirm.isEnabled(), 'frete calculado e botão habilitado');
      await confirm.click();
      await page.waitForURL((u: URL) => u.pathname.startsWith('/pedidos/'));
      const publicId = new URL(page.url()).pathname.split('/').pop()!;
      return prisma.order.findFirstOrThrow({ where: { publicId } });
    };
    const signedWebhook = async (externalId: string, bodyExtra: Record<string, unknown> = {}) => {
      const ts = String(Math.floor(Date.now() / 1000));
      const reqId = randomUUID();
      const v1 = createHmac('sha256', WEBHOOK_SECRET).update(`id:${externalId};request-id:${reqId};ts:${ts};`).digest('hex');
      return fetch(`${srv.base}/webhooks/mercadopago?data.id=${encodeURIComponent(externalId)}&type=payment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': reqId },
        body: JSON.stringify({ id: Date.now() + Math.floor(Math.random() * 1e6), type: 'payment', action: 'payment.updated', data: { id: externalId }, ...bodyExtra }),
      });
    };
    const apiLogin = async (email: string) => {
      const r = await fetch(`${srv.base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() }, body: JSON.stringify({ email, password: PASSWORD }) });
      const j: any = await r.json();
      const token = j?.data?.accessToken || j?.accessToken;
      assert.ok(token, `login API sem accessToken (${r.status})`);
      return token as string;
    };
    const only = (process.env.JOURNEY_ONLY || '').split(',').filter(Boolean);
    const scenario = async (id: string, name: string, fn: () => Promise<void>) => {
      if (only.length && !only.includes(id)) return;
      try { await fn(); results.push({ id, name, status: 'PASS' }); console.log(`  PASS ${id} ${name}`); }
      catch (e: any) { results.push({ id, name, status: 'FAIL', detail: String(e?.message || e).split('\n').filter(Boolean).slice(0, 3).join(' | ').slice(0, 400) }); console.log(`  FAIL ${id} ${name} :: ${String(e?.message || e).split('\n')[0].slice(0, 200)}`); }
    };
    const shot = (page: any, file: string) => page.screenshot({ path: join(ART, file), fullPage: true }).catch(() => {});

    // ---------- cenários ----------
    await scenario('J01', 'Checkout deslogado redireciona para o login com next=/checkout', async () => {
      const { ctx, page } = await newPage();
      await page.goto(`${WEB}/checkout`);
      await page.waitForURL((u: URL) => u.pathname === '/entrar');
      assert.equal(new URL(page.url()).searchParams.get('next'), '/checkout');
      await ctx.close();
    });

    await scenario('J02', 'Clique duplo em "Confirmar pedido" cria 1 pedido e reserva 1 vez', async () => {
      const user = await mkUser(); const p = await mkProduct(5);
      await seedCart(user.id, p.id, 2);
      const { ctx, page } = await newPage();
      await loginUI(page, user.email);
      await page.goto(`${WEB}/checkout`);
      const confirm = page.getByRole('button', { name: 'Confirmar pedido e pagar' });
      await waitFor(async () => confirm.isEnabled(), 'botão habilitado');
      await confirm.dblclick();
      await page.waitForURL((u: URL) => u.pathname.startsWith('/pedidos/'));
      await new Promise((r) => setTimeout(r, 800));
      assert.equal(await prisma.order.count({ where: { userId: user.id } }), 1, 'pedidos criados');
      assert.equal((await prisma.inventory.findUniqueOrThrow({ where: { productId: p.id } })).qtyReserved, 2, 'reserva');
      await ctx.close();
    });

    await scenario('J03', 'Estoque acaba entre a sacola e o clique: erro claro, nenhum pedido, nenhuma reserva', async () => {
      const user = await mkUser(); const p = await mkProduct(3);
      await seedCart(user.id, p.id, 2);
      const { ctx, page } = await newPage();
      await loginUI(page, user.email);
      await page.goto(`${WEB}/checkout`);
      const confirm = page.getByRole('button', { name: 'Confirmar pedido e pagar' });
      await waitFor(async () => confirm.isEnabled(), 'botão habilitado');
      await prisma.inventory.update({ where: { productId: p.id }, data: { qtyOnHand: 1 } });
      await confirm.click();
      await page.locator('.checkout-err').first().waitFor();
      const msg = await page.locator('.checkout-err').first().innerText();
      assert.match(msg, /Estoque insuficiente/i);
      assert.equal(await prisma.order.count({ where: { userId: user.id } }), 0);
      assert.equal((await prisma.inventory.findUniqueOrThrow({ where: { productId: p.id } })).qtyReserved, 0);
      // o cliente precisa saber onde corrigir (link para a sacola dentro do aviso)
      assert.ok(await page.locator('.checkout-err a[href="/carrinho"]').count(), 'aviso de estoque sem link para a sacola');
      await shot(page, 'J03-estoque.png');
      await ctx.close();
    });

    await scenario('J04', 'Recarregar /checkout depois de criar o pedido leva ao pedido pendente (não só "Sacola vazia")', async () => {
      const user = await mkUser(); const p = await mkProduct(5);
      await seedCart(user.id, p.id, 1);
      const { ctx, page } = await newPage();
      await loginUI(page, user.email);
      const order = await checkoutOrder(page);
      await page.goto(`${WEB}/checkout`);
      await page.getByText(/Sacola vazia/i).first().waitFor();
      await waitFor(async () => (await page.locator(`a[href="/pedidos/${order.publicId}"]`).count()) > 0, 'checkout vazio não aponta para o pedido aguardando pagamento');
      await shot(page, 'J04-checkout-vazio.png');
      await ctx.close();
    });

    await scenario('J05', 'Página do pedido mostra até quando os itens ficam reservados', async () => {
      const user = await mkUser(); const p = await mkProduct(5);
      await seedCart(user.id, p.id, 1);
      const { ctx, page } = await newPage();
      await loginUI(page, user.email);
      await checkoutOrder(page);
      await page.getByText(/Aguardando pagamento/i).first().waitFor();
      const body = await page.locator('.order-page').innerText();
      assert.match(body, /reservad|reserva/i, 'sem aviso de reserva com prazo');
      assert.match(body, /\d{2}:\d{2}/, 'sem horário limite');
      await shot(page, 'J05-pedido-pendente.png');
      await ctx.close();
    });

    await scenario('J06', 'Cartão APROVADO (Brick stub + MP falso): pedido pago, estoque baixa 1x, UI confirma', async () => {
      fake.nextCardStatus = { status: 'approved', status_detail: 'accredited' };
      const user = await mkUser(); const p = await mkProduct(4);
      await seedCart(user.id, p.id, 1);
      const { ctx, page } = await newPage({ stubBrick: true });
      await loginUI(page, user.email);
      const order = await checkoutOrder(page);
      await page.getByLabel(/Cartão/).check();
      await page.locator('#stub-brick-pay').click();
      await page.getByText('Pagamento no cartão: Aprovado').first().waitFor();
      await waitFor(async () => (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status === 'paid', 'pedido pago');
      const inv = await prisma.inventory.findUniqueOrThrow({ where: { productId: p.id } });
      assert.equal(inv.qtyOnHand, 3); assert.equal(inv.qtyReserved, 0);
      await shot(page, 'J06-cartao-aprovado.png');
      await ctx.close();
    });

    await scenario('J07', 'Cartão RECUSADO: aviso claro na tela, pedido segue aguardando, dá para tentar de novo sem recarregar', async () => {
      fake.nextCardStatus = { status: 'rejected', status_detail: 'cc_rejected_insufficient_amount' };
      const user = await mkUser(); const p = await mkProduct(4);
      await seedCart(user.id, p.id, 1);
      const { ctx, page } = await newPage({ stubBrick: true });
      await loginUI(page, user.email);
      const order = await checkoutOrder(page);
      await page.getByLabel(/Cartão/).check();
      await page.locator('#stub-brick-pay').click();
      await waitFor(async () => (await prisma.payment.count({ where: { orderId: order.id, status: 'refused' } })) === 1, 'pagamento recusado no DB');
      assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, 'awaiting_payment');
      await shot(page, 'J07-cartao-recusado.png');
      const text = await page.locator('.order-page').innerText();
      assert.match(text, /recusad/i, 'sem aviso de recusa');
      assert.ok(await page.locator('#stub-brick-pay').count(), 'formulário de cartão sumiu: sem como tentar de novo');
      // segunda tentativa (agora aprovada) na MESMA página
      fake.nextCardStatus = { status: 'approved', status_detail: 'accredited' };
      await page.locator('#stub-brick-pay').click();
      await page.getByText('Pagamento no cartão: Aprovado').first().waitFor();
      assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, 'paid');
      assert.equal(await prisma.payment.count({ where: { orderId: order.id, status: 'approved' } }), 1);
      await ctx.close();
    });

    await scenario('J08', 'PIX: webhook repetido e "pending" fora de ordem não duplicam baixa de estoque nem desfazem o pago', async () => {
      const user = await mkUser(); const p = await mkProduct(4);
      await seedCart(user.id, p.id, 1);
      const { ctx, page } = await newPage();
      await loginUI(page, user.email);
      const order = await checkoutOrder(page);
      await page.getByRole('button', { name: 'Pagar com PIX' }).click();
      await page.locator('textarea[readonly]').waitFor();
      const pay = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
      fake.setPayment(pay.externalId!, { status: 'approved', status_detail: 'accredited' });
      assert.equal((await signedWebhook(pay.externalId!)).status, 200);
      assert.equal((await signedWebhook(pay.externalId!)).status, 200); // repetido (ids de evento diferentes)
      fake.setPayment(pay.externalId!, { status: 'pending', status_detail: 'pending_waiting_transfer' });
      assert.equal((await signedWebhook(pay.externalId!)).status, 200); // notificação velha fora de ordem
      fake.setPayment(pay.externalId!, { status: 'approved', status_detail: 'accredited' });
      await new Promise((r) => setTimeout(r, 500));
      const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(paid.status, 'paid');
      const inv = await prisma.inventory.findUniqueOrThrow({ where: { productId: p.id } });
      assert.equal(inv.qtyOnHand, 3); assert.equal(inv.qtyReserved, 0);
      assert.equal(await prisma.payment.count({ where: { orderId: order.id, status: 'approved' } }), 1);
      await ctx.close();
    });

    await scenario('J09', 'Cotação com CEP malformado responde 4xx com mensagem (nunca 500 nem frete inventado)', async () => {
      for (const cep of ['123', 'abcdefgh', '']) {
        const r = await fetch(`${srv.base}/shipping/quote`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cep: cep || '12', subtotal: 100, items: [{ qty: 1 }] }) });
        assert.ok(r.status >= 400 && r.status < 500, `CEP ${cep}: status ${r.status}`);
        const j: any = await r.json();
        assert.ok(JSON.stringify(j).length > 5);
      }
    });

    await scenario('J10', 'Cliente B não lê nem paga o pedido do cliente A (404)', async () => {
      const a = await mkUser(); const b = await mkUser(); const p = await mkProduct(4);
      await seedCart(a.id, p.id, 1);
      const { ctx, page } = await newPage();
      await loginUI(page, a.email);
      const order = await checkoutOrder(page);
      await ctx.close();
      const tokenB = await apiLogin(b.email);
      const h = { authorization: `Bearer ${tokenB}`, 'content-type': 'application/json' };
      assert.equal((await fetch(`${srv.base}/orders/${order.publicId}`, { headers: h })).status, 404);
      const r = await fetch(`${srv.base}/payments/intents`, { method: 'POST', headers: { ...h, 'idempotency-key': randomUUID() }, body: JSON.stringify({ orderId: order.id, method: 'pix' }) });
      assert.equal(r.status, 404);
    });

    await scenario('J12', 'Sacola: quantidade acima do estoque é recusada com mensagem; subtotal atualiza', async () => {
      const user = await mkUser(); const p = await mkProduct(2, 50);
      await seedCart(user.id, p.id, 1);
      const { ctx, page } = await newPage();
      await loginUI(page, user.email);
      await page.getByRole('button', { name: 'Aumentar quantidade' }).click();
      await page.locator('.cart-stepper-qty', { hasText: '2' }).waitFor();
      await page.getByText(/R\$\s?100,00/).first().waitFor();
      assert.ok(await page.getByRole('button', { name: 'Aumentar quantidade' }).isDisabled(), 'permite passar do estoque');
      await ctx.close();
    });

    await scenario('J13', 'Cupom inválido e cupom expirado: mensagem junto ao campo, sem derrubar a sacola', async () => {
      const user = await mkUser(); const p = await mkProduct(5, 100);
      await seedCart(user.id, p.id, 1);
      const expiredCode = `EXP${randomUUID().slice(0, 6).toUpperCase()}`;
      await prisma.coupon.create({ data: { code: expiredCode, type: 'percent', value: 10, endsAt: new Date(Date.now() - 86400_000), active: true } });
      const { ctx, page } = await newPage();
      await loginUI(page, user.email);
      for (const code of ['NAOEXISTE', expiredCode]) {
        await page.locator('#cart-coupon').fill(code);
        await page.locator('#cart-coupon').press('Enter');
        await page.locator('.cart-coupon [role="alert"]').first().waitFor();
        const msg = await page.locator('.cart-coupon [role="alert"]').first().innerText();
        assert.ok(msg.trim().length > 5, `mensagem de cupom vazia (${code})`);
        await shot(page, `J13-cupom-${code}.png`);
        await page.locator('#cart-coupon').fill('');
      }
      assert.ok(await page.getByText(p.name).first().isVisible());
      await ctx.close();
    });

    await scenario('J14', 'Mobile 390px: sacola, checkout e pedido sem rolagem horizontal; botões principais ≥ 44px', async () => {
      const user = await mkUser(); const p = await mkProduct(5);
      await seedCart(user.id, p.id, 1);
      const { ctx, page } = await newPage({ mobile: true });
      await loginUI(page, user.email);
      const overflow = async (label: string) => {
        const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(o <= 1, `${label}: rolagem horizontal de ${o}px`);
      };
      await overflow('/carrinho'); await shot(page, 'J14-mobile-carrinho.png');
      await page.goto(`${WEB}/checkout`);
      const confirm = page.getByRole('button', { name: 'Confirmar pedido e pagar' });
      await waitFor(async () => confirm.isEnabled(), 'botão habilitado');
      await overflow('/checkout'); await shot(page, 'J14-mobile-checkout.png');
      const h = (await confirm.boundingBox())!.height;
      assert.ok(h >= 44, `botão confirmar com ${h}px`);
      await confirm.click();
      await page.waitForURL((u: URL) => u.pathname.startsWith('/pedidos/'));
      await page.getByRole('button', { name: 'Pagar com PIX' }).waitFor();
      await overflow('/pedidos/[id]'); await shot(page, 'J14-mobile-pedido.png');
      await ctx.close();
    });

    await scenario('J15', 'Pedido cancelado/expirado: página explica e oferece voltar às compras (sem mostrar pagamento)', async () => {
      const user = await mkUser(); const p = await mkProduct(5);
      await seedCart(user.id, p.id, 1);
      const { ctx, page } = await newPage();
      await loginUI(page, user.email);
      const order = await checkoutOrder(page);
      const token = await apiLogin(user.email);
      const r = await fetch(`${srv.base}/orders/${order.publicId}/cancel`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
      assert.ok(r.status < 300, `cancel ${r.status}`);
      await page.reload();
      await page.getByText(/Cancelado/i).first().waitFor();
      assert.equal(await page.getByRole('button', { name: 'Pagar com PIX' }).count(), 0, 'botão de pagar visível em pedido cancelado');
      assert.ok(await page.getByRole('link', { name: /Continuar comprando|Voltar à loja|Comprar de novo/i }).count(), 'sem caminho de volta às compras');
      assert.equal((await prisma.inventory.findUniqueOrThrow({ where: { productId: p.id } })).qtyReserved, 0, 'reserva não liberada');
      await shot(page, 'J15-pedido-cancelado.png');
      await ctx.close();
    });

    await scenario('J16', 'Sacola com item acima do estoque: aviso e botão de finalizar desabilitado', async () => {
      const user = await mkUser(); const p = await mkProduct(5);
      await seedCart(user.id, p.id, 3);
      await prisma.inventory.update({ where: { productId: p.id }, data: { qtyOnHand: 1 } });
      const { ctx, page } = await newPage();
      await loginUI(page, user.email);
      await page.getByText(/acima do estoque/i).first().waitFor();
      assert.ok(await page.locator('button.cart-checkout-btn').first().isDisabled(), 'botão de finalizar continua habilitado');
      assert.equal(await page.locator('a.cart-checkout-btn').count(), 0, 'link de finalizar continua ativo');
      await ctx.close();
    });

    const failed = results.filter((r) => r.status === 'FAIL');
    writeFileSync(join(ART, 'journey-results.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
    console.log(`\nJORNADA: ${results.length - failed.length} PASS / ${failed.length} FAIL`);
    if (failed.length) { for (const f of failed) console.log(`  - ${f.id}: ${f.detail}`); process.exitCode = 1; }
  } finally {
    await browser?.close().catch(() => {});
    try { process.kill(-web.pid!, 'SIGTERM'); } catch { /* already gone */ }
    await srv.close().catch(() => {});
    await prisma.$disconnect();
    await fake.stop?.();
  }
}

main().then(() => process.exit(process.exitCode || 0), (e) => { console.error(e); process.exit(1); });
