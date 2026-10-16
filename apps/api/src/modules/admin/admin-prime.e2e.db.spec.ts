/**
 * Admin Prime — HTTP E2E (Nest compilado, Postgres LOCAL). Fornecedor/custo e painel:
 * admin lê/grava, cliente recebe 403, anônimo 401, gravação vai para AuditLog,
 * a vitrine pública nunca devolve custo, e /admin/ops traz o alerta com número real.
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { bootHttpApp, compileApi } from '../finance/testing/compiled-app';

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url || /railway|rlwy|\.internal|prod/i.test(url) || !/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: DATABASE_URL deve ser local');
}

async function main() {
  assertLocalDb();
  Object.assign(process.env, {
    APP_ENV: 'development', NODE_ENV: 'development', FINANCE_RECONCILIATION_CRON_ENABLED: 'false',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'prime-e2e-access-secret-xxxxxxxxxxx',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'prime-e2e-refresh-secret-xxxxxxxxxx',
    REFRESH_COOKIE_SECURE: 'false',
  });
  if (!process.env.SKIP_E2E_COMPILE) compileApi();
  const srv = await bootHttpApp();
  const prisma = new PrismaClient({ log: ['error'] });
  const base = srv.base;
  let ipSeq = 1;
  const ip = () => `10.88.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;
  async function http(method: string, path: string, cookie?: string, body?: unknown) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(), ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, json, text };
  }
  async function user(role: 'customer' | 'admin') {
    const email = `prime-${role}-${randomUUID().slice(0, 8)}@test.local`;
    const password = 'Prime-e2e-Pass-123';
    await prisma.user.create({ data: { email, passwordHash: await argon2.hash(password), name: `Prime ${role}`, role, status: 'active' } });
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip() }, body: JSON.stringify({ email, password }) });
    assert.equal(r.status, 201, `login ${role}`);
    return r.headers.getSetCookie().map((c) => c.split(';')[0]).filter((c) => /^sch_(access|refresh)=/.test(c)).join('; ');
  }
  const seller = await prisma.seller.upsert({ where: { slug: 'lojas-schimitz' }, update: {}, create: { id: '00000000-0000-4000-8000-000000000001', name: 'Lojas Schimitz', slug: 'lojas-schimitz', status: 'active' } });
  const sku = `PRIME-E2E-${randomUUID().slice(0, 8)}`;
  const p = await prisma.product.create({ data: { sku, name: `Prime ${sku}`, slug: sku.toLowerCase(), price: 200, active: true, sellerId: seller.id, inventory: { create: { qtyOnHand: 3, qtyReserved: 0 } } } });
  const admin = await user('admin');
  const customer = await user('customer');
  const path = `/admin/products/${p.id}/supplier`;
  const body = { supplierName: 'Fornecedor Teste', supplierSku: 'F-1', costPrice: 120, leadTimeDays: 7 };

  assert.equal((await http('GET', path)).status, 401, 'anônimo 401');
  assert.equal((await http('GET', path, customer)).status, 403, 'cliente GET 403');
  assert.equal((await http('PUT', path, customer, body)).status, 403, 'cliente PUT 403');
  assert.equal((await http('GET', '/admin/ops', customer)).status, 403, 'cliente ops 403');
  assert.equal(await prisma.productSupplier.count({ where: { productId: p.id } }), 0, 'cliente não gravou');

  const empty = await http('GET', path, admin);
  assert.equal(empty.status, 200);
  assert.equal(empty.json.data.supplier, null, 'sem cadastro = null (nada inventado)');
  assert.equal(empty.json.data.grossMarginPct, null);

  const ops1 = await http('GET', '/admin/ops', admin);
  assert.equal(ops1.status, 200);
  const before = ops1.json.data.catalog.missingSupplierCount;
  assert.ok(typeof before === 'number' && before >= 1, 'ops conta produto sem fornecedor');
  assert.ok(ops1.json.data.alerts.some((a: any) => a.code === 'products_missing_supplier'));

  assert.equal((await http('PUT', path, admin, { supplierName: '' })).status, 400, 'validação');
  const saved = await http('PUT', path, admin, body);
  assert.equal(saved.status, 200, saved.text);
  assert.equal(saved.json.data.supplier.costPrice, 120);
  assert.equal(saved.json.data.grossMarginPct, 40);
  const audit = await prisma.auditLog.findFirst({ where: { action: { contains: `/supplier` }, entityId: p.id }, orderBy: { createdAt: 'desc' } })
    ?? await prisma.auditLog.findFirst({ where: { action: { contains: `/supplier` } }, orderBy: { createdAt: 'desc' } });
  assert.ok(audit, 'PUT gravado no AuditLog');

  const ops2 = await http('GET', '/admin/ops', admin);
  assert.equal(ops2.json.data.catalog.missingSupplierCount, before - 1, 'contagem real caiu 1');

  const pub = await http('GET', `/products/${p.slug}`);
  assert.equal(pub.status, 200);
  assert.ok(!/costPrice|supplierName|Fornecedor Teste/.test(pub.text), 'vitrine não vaza custo/fornecedor');
  const list = await http('GET', `/products?q=${encodeURIComponent(sku)}`);
  assert.ok(!/costPrice|supplierName/.test(list.text), 'listagem não vaza custo');

  // Importação em lote (Prime 2): cliente 403, conferência não grava, erro bloqueia tudo, aplicar grava e audita.
  const p2 = await prisma.product.create({ data: { sku: `${sku}-B`, name: `Prime B`, slug: `${sku.toLowerCase()}-b`, price: 100, active: true, sellerId: seller.id, inventory: { create: { qtyOnHand: 1, qtyReserved: 0 } } } });
  const csv = `sku;fornecedor;custo;prazo_dias\n${sku}-B;Forn Lote;55,90;4\n`;
  assert.equal((await http('POST', '/admin/suppliers/import', customer, { csv })).status, 403, 'cliente import 403');
  assert.equal((await http('POST', '/admin/suppliers/import', undefined, { csv })).status, 401, 'anônimo import 401');
  const dry = await http('POST', '/admin/suppliers/import', admin, { csv });
  assert.equal(dry.status, 201, dry.text);
  assert.equal(dry.json.data.dryRun, true);
  assert.equal(dry.json.data.summary.criar, 1);
  assert.equal(await prisma.productSupplier.count({ where: { productId: p2.id } }), 0, 'conferência não grava');
  const withErr = await http('POST', '/admin/suppliers/import', admin, { csv: csv + 'NAO-EXISTE;X;;\n', dryRun: false });
  assert.equal(withErr.json.data.applied, false);
  assert.equal(withErr.json.data.errorCount, 1);
  assert.equal(await prisma.productSupplier.count({ where: { productId: p2.id } }), 0, 'erro = nada gravado');
  const applied = await http('POST', '/admin/suppliers/import', admin, { csv, dryRun: false });
  assert.equal(applied.json.data.applied, true, applied.text);
  const row = await prisma.productSupplier.findUnique({ where: { productId: p2.id } });
  assert.equal(Number(row?.costPrice), 55.9);
  assert.ok(await prisma.auditLog.findFirst({ where: { action: { contains: 'suppliers/import' } } }), 'import auditado');
  const again = await http('POST', '/admin/suppliers/import', admin, { csv });
  assert.equal(again.json.data.summary.semMudanca, 1, 'reimportar igual = sem mudança');
  await prisma.product.update({ where: { id: p2.id }, data: { active: false } });

  await prisma.product.update({ where: { id: p.id }, data: { active: false } });
  await srv.close();
  await prisma.$disconnect();
  console.log('admin-prime.e2e.db.spec: PASSOU (401/403/200, auditoria, ops real, sem vazamento público)');
  process.exit(0);
}

main().catch((e) => {
  console.error('admin-prime.e2e.db.spec FALHOU', e);
  process.exit(1);
});
