/**
 * E2E de navegador: loja (Next `next start`) → carrinho → checkout → PIX → webhook assinado → pedido pago.
 *
 *  - Postgres LOCAL apenas (recusa URL remota/produção). Dados sintéticos criados aqui.
 *  - Mercado Pago = servidor FALSO local (token TEST-FAKE-LOCAL); envs reais de MP são apagadas e
 *    FINANCE_TEST_MODE=true bloqueia api.mercadopago.com no adapter. Nenhuma cobrança real.
 *  - API compilada com tsc e servida em 127.0.0.1:3001 (default de NEXT_PUBLIC_API_URL no build).
 *  - Web: build de produção já existente em apps/web/.next, servido por `next start` em :3000.
 *  - Navegador: playwright-core + Chrome do sistema (CHROME_PATH). `bypassCSP` porque a CSP de produção
 *    (correta) não libera http://localhost:3001; a CSP é testada à parte (storefront-csp*.spec).
 *
 * Pré-requisitos: DATABASE_URL local migrado/seedado; `npm run build` em apps/web;
 * playwright-core resolvível (CI instala com --no-save; ver ci.yml job e2e).
 * Uso: npm run test:e2e:browser  (em apps/api)
 */
import assert from 'assert';
import { spawn, type ChildProcess } from 'child_process';
import { createHmac, randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
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
const ART = process.env.E2E_ARTIFACTS_DIR || '/tmp/storefront-e2e';
const REAL_MP_ENV = ['MERCADO_PAGO_ACCESS_TOKEN', 'MP_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET', 'MP_WEBHOOK_SECRET', 'STAGING_MP_ACCESS_TOKEN', 'STAGING_MP_CLIENT_SECRET', 'PROD_MP_MARKETPLACE_CLIENT_SECRET', 'MERCADO_PAGO_PUBLIC_KEY', 'MERCADO_PAGO_USER_ID', 'PUBLIC_API_URL'];

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url || /railway|rlwy|\.internal|prod/i.test(url) || !/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: DATABASE_URL deve ser local');
}

async function waitHttp(url: string, ms: number) {
  const until = Date.now() + ms;
  for (;;) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch { /* not up yet */ }
    if (Date.now() > until) throw new Error(`timeout esperando ${url}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

function startWeb(): ChildProcess {
  assert.ok(existsSync(join(WEB_DIR, '.next', 'BUILD_ID')), 'apps/web sem build (.next/BUILD_ID) — rode npm run build em apps/web');
  const child = spawn('npx', ['next', 'start', '-p', String(WEB_PORT)], {
    cwd: WEB_DIR,
    env: { ...process.env, PORT: String(WEB_PORT), API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  child.stdout?.on('data', (d) => process.env.E2E_VERBOSE && process.stdout.write(`[web] ${d}`));
  child.stderr?.on('data', (d) => process.stdout.write(`[web:err] ${d}`));
  return child;
}

async function main() {
  assertLocalDb();
  mkdirSync(ART, { recursive: true });
  for (const k of REAL_MP_ENV) delete process.env[k];
  const fake = new FakeMercadoPagoServer();
  await fake.start();
  Object.assign(process.env, {
    APP_ENV: 'development', NODE_ENV: 'development', PAYMENTS_PROVIDER: 'mercadopago',
    MERCADO_PAGO_ACCESS_TOKEN: 'TEST-FAKE-LOCAL', MERCADO_PAGO_WEBHOOK_SECRET: WEBHOOK_SECRET, MERCADO_PAGO_API_BASE_URL: fake.baseUrl,
    FINANCE_TEST_MODE: 'true', FINANCE_RECONCILIATION_CRON_ENABLED: 'false',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'browser-e2e-access-secret-xxxxxxxxxx',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'browser-e2e-refresh-secret-xxxxxxxxx',
    REFRESH_COOKIE_SECURE: 'false',
  });
  console.log(`[${fake.label}] ${fake.baseUrl}`);
  compileApi();
  const srv = await bootHttpApp(API_PORT);
  console.log(`API: ${srv.base}`);
  const prisma = new PrismaClient({ log: ['error'] });
  const web = startWeb();
  let browser: any;
  let page: any;
  const t0 = Date.now();
  try {
    await waitHttp(`${WEB}/`, 60_000);
    console.log(`web: ${WEB} (${Date.now() - t0}ms)`);

    // ---- dados sintéticos ----
    const seller = await prisma.seller.upsert({ where: { slug: 'lojas-schimitz' }, update: {}, create: { id: '00000000-0000-4000-8000-000000000001', name: 'Lojas Schimitz', slug: 'lojas-schimitz', status: 'active' } });
    const sku = `E2E-BROWSER-${randomUUID().slice(0, 8)}`;
    const product = await prisma.product.create({ data: { sku, name: `Produto E2E ${sku}`, slug: sku.toLowerCase(), description: 'produto sintético do e2e de navegador', price: 100, active: true, sellerId: seller.id, inventory: { create: { qtyOnHand: 3, qtyReserved: 0 } } } });
    const email = `e2e-browser-${randomUUID().slice(0, 8)}@test.local`;
    const password = 'Browser-e2e-Pass-123';
    const user = await prisma.user.create({ data: { email, passwordHash: await argon2.hash(password), name: 'Cliente E2E', role: 'customer', status: 'active', phone: '51999999999' } });
    await prisma.address.create({ data: { userId: user.id, label: 'Casa', cep: '91250000', street: 'Rua Teste', number: '1', district: 'Centro', city: 'Porto Alegre', uf: 'RS', isDefault: true } });

    // ---- navegador ----
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { chromium } = require('playwright-core');
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ bypassCSP: true, locale: 'pt-BR', viewport: { width: 1280, height: 900 } });
    page = await ctx.newPage();
    page.setDefaultTimeout(20_000);
    const consoleErrors: string[] = [];
    page.on('pageerror', (e: Error) => consoleErrors.push(String(e)));

    // 1. login pela UI
    await page.goto(`${WEB}/entrar?next=/carrinho`);
    await page.fill('#signup-email', email);
    await page.click('button.acct-cta');
    await page.getByLabel('Senha', { exact: true }).fill(password);
    await page.click('button.acct-cta');
    await page.waitForURL((u: URL) => u.pathname === '/carrinho');
    console.log('  PASS login pela UI');

    // 2. PDP → adicionar à sacola
    await page.goto(`${WEB}/produto/${product.slug}`);
    await page.getByRole('heading', { name: product.name }).first().waitFor();
    await page.getByRole('button', { name: 'Adicionar à sacola' }).first().click();
    await waitFor(async () => (await prisma.cartItem.count({ where: { productId: product.id, cart: { userId: user.id } } })) === 1, 'item no carrinho (DB)');
    console.log('  PASS PDP → adicionar à sacola');

    // 3. carrinho → checkout
    await page.goto(`${WEB}/carrinho`);
    await page.getByText(product.name).first().waitFor();
    await page.locator('a.cart-checkout-btn').first().click();
    await page.waitForURL((u: URL) => u.pathname === '/checkout');
    const confirm = page.getByRole('button', { name: 'Confirmar pedido e pagar' });
    await waitFor(async () => confirm.isEnabled(), 'frete calculado e botão habilitado');
    await confirm.click();
    await page.waitForURL((u: URL) => u.pathname.startsWith('/pedidos/'));
    const publicId = new URL(page.url()).pathname.split('/').pop()!;
    const order = await prisma.order.findFirstOrThrow({ where: { publicId } });
    assert.equal(order.userId, user.id);
    assert.equal((await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } })).qtyReserved, 1);
    console.log(`  PASS checkout → pedido ${publicId} (estoque reservado)`);

    // 4. pagar com PIX → QR do MP falso
    await page.getByRole('button', { name: 'Pagar com PIX' }).click();
    const qr = page.locator('textarea[readonly]');
    await qr.waitFor();
    const qrValue = await qr.inputValue();
    assert.match(qrValue, /^TEST-FAKE-QR-/);
    const pay = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    assert.equal(pay.method, 'pix');
    assert.equal(fake.count('POST', /\/v1\/payments$/), 1, '1 criação de pagamento no MP falso');
    console.log(`  PASS PIX gerado (QR copia-e-cola do MP falso, payment ${pay.externalId})`);

    // 5. MP falso aprova + webhook assinado → pedido pago, visto pela UI
    fake.setPayment(pay.externalId!, { status: 'approved', status_detail: 'accredited' });
    const ts = String(Math.floor(Date.now() / 1000));
    const reqId = randomUUID();
    const v1 = createHmac('sha256', WEBHOOK_SECRET).update(`id:${pay.externalId};request-id:${reqId};ts:${ts};`).digest('hex');
    const w = await fetch(`${srv.base}/webhooks/mercadopago?data.id=${encodeURIComponent(pay.externalId!)}&type=payment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': reqId },
      body: JSON.stringify({ id: Date.now(), type: 'payment', action: 'payment.updated', data: { id: pay.externalId } }),
    });
    assert.equal(w.status, 200, `webhook ${w.status}`);
    await page.reload();
    await page.getByText('Pagamento PIX: Aprovado').first().waitFor();
    const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(paid.status, 'paid');
    const inv = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    assert.equal(inv.qtyOnHand, 2);
    assert.equal(inv.qtyReserved, 0);
    assert.deepEqual(consoleErrors, [], 'sem erros de JS na página');
    console.log('  PASS webhook assinado → pedido pago na UI; estoque 3→2');
    await page.screenshot({ path: join(ART, 'pedido-pago.png'), fullPage: true });
    console.log(`storefront-pix.browser.e2e OK (${Date.now() - t0}ms)`);
  } catch (e) {
    if (page) await page.screenshot({ path: join(ART, 'falha.png'), fullPage: true }).catch(() => {});
    console.error(`FALHA — screenshot em ${ART}/falha.png`);
    throw e;
  } finally {
    await browser?.close().catch(() => {});
    try { process.kill(-web.pid!, 'SIGTERM'); } catch { /* already gone */ }
    await srv.close().catch(() => {});
    await prisma.$disconnect();
    await fake.stop?.();
  }
}

async function waitFor(fn: () => Promise<boolean>, what: string, ms = 20_000) {
  const until = Date.now() + ms;
  for (;;) {
    if (await fn().catch(() => false)) return;
    if (Date.now() > until) throw new Error(`timeout: ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
