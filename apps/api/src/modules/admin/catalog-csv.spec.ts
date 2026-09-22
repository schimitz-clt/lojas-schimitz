/**
 * In-process CSV parse/validate/upsert planning. Fixture SKUs are fictional.
 * Does not open a database and does not seed the catalog.
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CATALOG_CSV_MAX_ROWS,
  CATALOG_CSV_TEMPLATE,
  matchCategory,
  parseCatalogMoney,
  planCatalogUpserts,
  slugifyProductName,
  validateCatalogCsv,
} from './catalog-csv';
import {
  adminProductListWindow,
  buildAdminProductSearchWhere,
  isLegacyAdminProductList,
  nextBatchPrice,
  nextBatchStock,
  planProductBatch,
} from './admin-products-query';
import { catalogListWindow } from '../catalog/catalog.query';

const FIXTURE = [
  'sku;nome;preco;estoque;ativo;categoria;imagens',
  'FICT-001;Lanterna de teste;19,90;3;sim;ferramentas;',
  'FICT-002;Corda de teste;1.299,90;0;nao;;',
  'FICT-003;;10,00;1;sim;;',
  'FICT-001;Duplicada;10,00;1;sim;;',
  'FICT-004;Preco ruim;abc;1;sim;;',
  'FICT-005;Placeholder;12,00;1;sim;;https://placehold.co/800x800?text=FICT',
].join('\n');

{
  assert.equal(parseCatalogMoney('19,90'), 19.9);
  assert.equal(parseCatalogMoney('1.299,90'), 1299.9);
  assert.equal(parseCatalogMoney('1299.90'), 1299.9);
  assert.equal(parseCatalogMoney('1.299'), 1299);
  assert.equal(parseCatalogMoney('R$ 49,90'), 49.9);
  assert.equal(parseCatalogMoney('-1'), null);
  assert.equal(parseCatalogMoney('abc'), null);
  assert.equal(slugifyProductName('Lâmpada LED'), 'lampada-led');
  console.log('catalog-csv: money + slug — PASSOU');
}

{
  const parsed = validateCatalogCsv(FIXTURE);
  assert.equal(parsed.fileError, null);
  const bySku = new Map(parsed.rows.map((r) => [r.sku, r]));
  assert.equal(bySku.get('FICT-001')?.price, 19.9);
  assert.equal(bySku.get('FICT-001')?.stock, 3);
  assert.equal(bySku.get('FICT-001')?.active, true);
  assert.equal(bySku.get('FICT-001')?.category, 'ferramentas');
  assert.equal(bySku.get('FICT-002')?.price, 1299.9);
  assert.equal(bySku.get('FICT-002')?.active, false);
  assert.equal(bySku.has('FICT-003'), true);
  assert.equal(bySku.has('FICT-004'), false);
  assert.equal(bySku.has('FICT-005'), false);
  assert.ok(parsed.errors.some((e) => e.sku === 'FICT-001' && e.line === 5));
  assert.ok(parsed.errors.some((e) => e.sku === 'FICT-004' && /Preço inválido/.test(e.message)));
  assert.ok(parsed.errors.some((e) => e.sku === 'FICT-005' && /placeholder/i.test(e.message)));
  console.log('catalog-csv: fixture rows — PASSOU');
}

{
  const parsed = validateCatalogCsv(FIXTURE);
  const plan = planCatalogUpserts(parsed.rows, new Set(['FICT-001']));
  const create = plan.actions.filter((a) => a.kind === 'create').map((a) => a.row.sku);
  const update = plan.actions.filter((a) => a.kind === 'update').map((a) => a.row.sku);
  assert.deepEqual(update, ['FICT-001']);
  assert.ok(create.includes('FICT-002'));
  assert.ok(!create.includes('FICT-003'));
  assert.ok(plan.errors.some((e) => e.sku === 'FICT-003' && /Nome obrigatório/.test(e.message)));
  assert.ok(plan.actions.every((a) => a.kind === 'create' || a.kind === 'update'));
  console.log('catalog-csv: upsert plan — PASSOU');
}

{
  const onlyStock = validateCatalogCsv('sku;estoque\nFICT-001;8\n');
  assert.equal(onlyStock.fileError, null);
  const plan = planCatalogUpserts(onlyStock.rows, new Set(['FICT-001']));
  assert.equal(plan.actions[0]?.kind, 'update');
  assert.equal(plan.actions[0]?.row.price, undefined);
  assert.equal(plan.actions[0]?.row.stock, 8);
  const emptyPrice = validateCatalogCsv('sku;preco;estoque\nFICT-009;;4\n');
  const create = planCatalogUpserts(emptyPrice.rows, new Set());
  assert.equal(create.actions.length, 0);
  assert.ok(create.errors.some((e) => /Nome obrigatório/.test(e.message)));
  console.log('catalog-csv: empty cells do not erase — PASSOU');
}

{
  const wipe = validateCatalogCsv('sku;nome;apagar\nFICT-001;X;sim\n');
  assert.match(wipe.fileError || '', /não apaga/i);
  assert.equal(wipe.rows.length, 0);
  const huge = `sku;nome;preco\n${Array.from({ length: CATALOG_CSV_MAX_ROWS + 1 }, (_, i) => `FICT-${i};Item;10`).join('\n')}\n`;
  const over = validateCatalogCsv(huge);
  assert.match(over.fileError || '', /Nada foi gravado/);
  assert.equal(over.rows.length, 0);
  const comma = validateCatalogCsv('sku,nome,preco\nFICT-010,"Nome, com vírgula",10.50\n');
  assert.equal(comma.rows[0]?.name, 'Nome, com vírgula');
  assert.equal(comma.rows[0]?.price, 10.5);
  assert.match(CATALOG_CSV_TEMPLATE, /^sku;nome;/);
  assert.ok(!CATALOG_CSV_TEMPLATE.includes('FICT-'));
  console.log('catalog-csv: reject wipe / oversize / quoted comma — PASSOU');
}

{
  const cats = [
    { id: 'c1', slug: 'ferramentas', name: 'Ferramentas' },
    { id: 'c2', slug: 'casa', name: 'Casa' },
  ];
  assert.equal(matchCategory(undefined, cats).kind, 'omit');
  assert.equal(matchCategory('', cats).kind, 'omit');
  const hit = matchCategory('Ferramentas', cats);
  assert.equal(hit.kind, 'id');
  if (hit.kind === 'id') assert.equal(hit.id, 'c1');
  const miss = matchCategory('inexistente', cats);
  assert.equal(miss.kind, 'error');
  console.log('catalog-csv: category match — PASSOU');
}

{
  assert.equal(isLegacyAdminProductList({}), true);
  assert.equal(isLegacyAdminProductList({ lowStock: 5 }), true);
  assert.equal(isLegacyAdminProductList({ q: 'FICT-001' }), false);
  assert.equal(isLegacyAdminProductList({ page: 1 }), false);
  const win = adminProductListWindow({ page: 3, pageSize: 1000 });
  assert.equal(win.page, 3);
  assert.equal(win.pageSize, 50);
  assert.equal(win.skip, 100);
  const where = buildAdminProductSearchWhere({ q: 'FICT', active: true });
  assert.equal(where.active, true);
  assert.ok(where.OR?.some((c) => 'sku' in c));
  assert.ok(where.OR?.some((c) => 'name' in c));
  assert.equal('ean' in where, false);
  const pub = catalogListWindow('4', '24');
  assert.equal(pub.skip, 72);
  assert.equal(pub.pageSize, 24);
  console.log('admin-products-query: pagination — PASSOU');
}

{
  const none = planProductBatch({ skus: [] });
  assert.equal(none.ok, false);
  const wildcard = planProductBatch({ skus: ['*'], active: false });
  assert.equal(wildcard.ok, false);
  const ok = planProductBatch({
    skus: ['FICT-001', 'FICT-001', 'FICT-002'],
    active: false,
    priceMode: 'percent',
    priceValue: 10,
    stockMode: 'delta',
    stockValue: -1,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.deepEqual(ok.skus, ['FICT-001', 'FICT-002']);
    assert.equal(ok.active, false);
  }
  const percent = nextBatchPrice(100, 'percent', 10);
  assert.equal(percent, 110);
  const set = nextBatchPrice(100, 'set', 19.9);
  assert.equal(set, 19.9);
  assert.equal(nextBatchPrice(10, 'percent', -101), null);
  const tooLow = planProductBatch({ skus: ['FICT-001'], priceMode: 'percent', priceValue: -100 });
  assert.equal(tooLow.ok, false);
  assert.equal(nextBatchStock(5, 'delta', -2), 3);
  assert.equal(nextBatchStock(1, 'delta', -5), null);
  assert.equal(nextBatchStock(4, 'set', 9), 9);
  console.log('admin-products-query: batch plan — PASSOU');
}

{
  const service = readFileSync(join(__dirname, 'admin-products.service.ts'), 'utf8');
  const controller = readFileSync(join(__dirname, 'admin.controller.ts'), 'utf8');
  assert.ok(service.includes('importCsv'));
  assert.ok(service.includes('applyBatch'));
  assert.ok(!service.includes('product.deleteMany'));
  assert.ok(!service.includes('productImage.deleteMany'));
  assert.ok(controller.includes("@Post('products/import')"));
  assert.ok(controller.includes("@Post('products/batch')"));
  const schema = readFileSync(join(__dirname, '../../../../../prisma/schema.prisma'), 'utf8');
  assert.ok(schema.includes('@@index([categoryId])'));
  assert.ok(!/^\s+ean\s/m.test(schema));
  assert.ok(!/^\s+gtin\s/m.test(schema));
  console.log('catalog-csv: no wipe + category index — PASSOU');
}

console.log('catalog-csv.spec ok');
