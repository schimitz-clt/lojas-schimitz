/**
 * Produtos ativos sem peso/medidas: resumo, alerta e CSV — unit + Postgres LOCAL. Nunca inventa valores.
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma.service';
import { AdminController } from './admin.controller';
import { validateCatalogCsv } from './catalog-csv';
import { deriveOpsAlerts, missingShippingFields, shippingDataMissingCsv, summarizeShippingData } from './admin-ops';

const full = { weightKg: 1.2, widthCm: 10, heightCm: 5, lengthCm: 20 };
assert.deepEqual(missingShippingFields(full), []);
assert.deepEqual(missingShippingFields({ ...full, weightKg: null }), ['peso_kg']);
assert.deepEqual(missingShippingFields({ ...full, widthCm: 0, lengthCm: '' }), ['largura_cm', 'comprimento_cm']);
assert.deepEqual(missingShippingFields({ weightKg: null, widthCm: null, heightCm: null, lengthCm: null }).length, 4);

const rows = [
  { id: '1', sku: 'SKA', name: 'Ok', ...full },
  { id: '2', sku: 'SKB', name: 'Sem peso', ...full, weightKg: null },
  { id: '3', sku: 'SKC', name: '=HYPERLINK("x")', weightKg: 2, widthCm: null, heightCm: null, lengthCm: null },
];
const sum = summarizeShippingData(rows);
assert.equal(sum.activeCount, 3);
assert.equal(sum.missingCount, 2);
assert.equal(sum.missingWeightCount, 1);
assert.equal(sum.missingDimensionsCount, 1);
assert.deepEqual(sum.sample.map((s) => s.sku), ['SKB', 'SKC']);
const csv = shippingDataMissingCsv(rows);
const lines = csv.trim().split('\n');
assert.equal(lines[0], 'sku;nome_referencia;peso_kg;largura_cm;altura_cm;comprimento_cm;faltando');
assert.equal(lines.length, 3, 'só produtos com falta');
assert.equal(lines[1], 'SKB;Sem peso;;10;5;20;peso_kg', 'campo vazio, nunca valor inventado');
assert.ok(lines[2].startsWith(`SKC;"'=HYPERLINK(""x"")";2;;;;`), `CSV sem injeção de fórmula: ${lines[2]}`);

// Reimportável: o importador aceita a planilha, só lê sku + peso/medidas e não toca no nome.
const reimport = validateCatalogCsv(csv);
assert.equal(reimport.fileError, null);
assert.deepEqual(reimport.errors, []);
assert.equal(reimport.rows.length, 2);
assert.ok(reimport.rows.every((r) => r.name === undefined), 'nome_referencia não pode virar nome');
const rb = reimport.rows.find((r) => r.sku === 'SKB')!;
assert.equal(rb.weightKg, undefined, 'peso vazio continua vazio');
assert.equal(rb.widthCm, 10);
const filled = csv.replace('SKB;Sem peso;;10', 'SKB;Sem peso;1.5;10');
assert.equal(validateCatalogCsv(filled).rows.find((r) => r.sku === 'SKB')!.weightKg, 1.5);

const alerts = deriveOpsAlerts({ lowStockCount: 0, outOfStockCount: 0, placeholderProductCount: 0, pendingPaymentCount: 0, productsMissingShippingData: 2 });
const a = alerts.find((x) => x.code === 'products_missing_shipping_data');
assert.ok(a);
assert.equal(a!.count, 2);
assert.equal(a!.severity, 'warn');
assert.equal(a!.section, 'catalog');
assert.ok(!deriveOpsAlerts({ lowStockCount: 0, outOfStockCount: 0, placeholderProductCount: 0, pendingPaymentCount: 0, productsMissingShippingData: 0 }).some((x) => x.code === 'products_missing_shipping_data'));

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  if (/railway|rlwy|\.internal/i.test(url)) throw new Error('RECUSADO: DATABASE_URL parece produção/Railway');
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: DATABASE_URL deve ser localhost/127.0.0.1');
}

async function main() {
  assertLocalDb();
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'shp-access-secret-local-xxxxxxx';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'shp-refresh-secret-local-xxxxxx';
  const app: INestApplicationContext = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const ctrl = app.get(AdminController);
  const tag = randomUUID().slice(0, 8);
  const ids: string[] = [];
  try {
    const before = (await ctrl.productsMissingShippingData()).data.summary;
    const seller = await prisma.seller.upsert({
      where: { slug: 'lojas-schimitz' },
      update: {},
      create: { id: '00000000-0000-4000-8000-000000000001', name: 'Lojas Schimitz', slug: 'lojas-schimitz', status: 'active' },
    });
    const mk = async (n: number, extra: Record<string, unknown>) => {
      const p = await prisma.product.create({
        data: { name: `Frete ${tag} ${n}`, slug: `frete-${tag}-${n}`, sku: `FRT-${tag}-${n}`, description: 't', price: 10, sellerId: seller.id, ...extra },
      });
      ids.push(p.id);
    };
    await mk(1, { active: true, weightKg: 1, widthCm: 10, heightCm: 10, lengthCm: 10 }); // completo
    await mk(2, { active: true, weightKg: 1 }); // sem medidas → conta
    await mk(3, { active: false }); // inativo → não conta
    await mk(4, { active: true, isDemo: true }); // demo → não conta
    const after = (await ctrl.productsMissingShippingData()).data;
    assert.equal(after.filename, 'produtos-sem-peso-medidas.csv');
    assert.equal(after.summary.activeCount - before.activeCount, 2);
    assert.equal(after.summary.missingCount - before.missingCount, 1);
    assert.ok(after.csv.includes(`FRT-${tag}-2;`));
    assert.ok(!after.csv.includes(`FRT-${tag}-1;`));
    assert.ok(!after.csv.includes(`FRT-${tag}-3;`));
    assert.ok(!after.csv.includes(`FRT-${tag}-4;`));
    const ops = (await ctrl.ops()).data as { catalog: { shippingData: { missingCount: number } }; alerts: { code: string; count: number }[] };
    assert.equal(ops.catalog.shippingData.missingCount, after.summary.missingCount);
    const alert = ops.alerts.find((x) => x.code === 'products_missing_shipping_data');
    assert.equal(alert?.count, after.summary.missingCount);
    console.log('shipping-data.db.spec ok');
  } finally {
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
