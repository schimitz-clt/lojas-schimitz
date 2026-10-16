import assert from 'assert';
import { parseCsv, planSupplierImport, validateSupplierCsv } from './supplier-csv';

assert.deepEqual(parseCsv('\uFEFFa;b\n"x;1";"di""z"\n'), [['a', 'b'], ['x;1', 'di"z']]);
assert.deepEqual(parseCsv('a,b\r\n1,2'), [['a', 'b'], ['1', '2']]);

const ok = validateSupplierCsv('sku;fornecedor;custo;prazo_dias;link\nA1;Forn A;1.234,50;7;https://f.com/a\nB2;Forn B;;;\n');
assert.equal(ok.errors.length, 0, JSON.stringify(ok.errors));
assert.equal(ok.rows[0].data.costPrice, 1234.5);
assert.equal(ok.rows[0].data.leadTimeDays, 7);
assert.equal(ok.rows[1].data.costPrice, null);

assert.match(validateSupplierCsv('sku;nome\nA;b').errors[0].message, /fornecedor/);
assert.equal(validateSupplierCsv('').errors[0].message, 'Planilha vazia.');
const bad = validateSupplierCsv('sku;fornecedor;custo;prazo_dias;link\nA;F;abc;;\nA;F;;;\n;F;;;\nC;F;-1;;\nD;F;;999;\nE;F;;;javascript:x\n');
assert.deepEqual(bad.errors.map((e) => e.line), [2, 3, 4, 5, 6, 7]);
assert.equal(bad.errors[1].message, 'SKU repetido na planilha.');

const plan = planSupplierImport(
  [...ok.rows, { line: 9, sku: 'ZZ', data: ok.rows[1].data }],
  [
    { id: 'p1', sku: 'a1', name: 'Prod A', supplier: null },
    { id: 'p2', sku: 'B2', name: 'Prod B', supplier: { supplierName: 'Forn B', supplierSku: null, supplierUrl: null, costPrice: null, leadTimeDays: null, notes: null } },
  ],
);
assert.deepEqual(plan.summary, { criar: 1, atualizar: 0, semMudanca: 1 });
assert.equal(plan.writes.length, 1);
assert.equal(plan.errors[0].message, 'SKU não existe no catálogo.');
console.log('supplier-csv: PASSOU');
