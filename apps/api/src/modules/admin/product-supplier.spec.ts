import assert from 'assert';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AdminProductSupplierDto, grossMarginPct, toProductSupplierView } from './product-supplier';

const v = (body: unknown) => validateSync(plainToInstance(AdminProductSupplierDto, body as object));

assert.equal(v({ supplierName: 'Fornecedor X', costPrice: '12,50', leadTimeDays: 5 }).length, 0);
assert.ok(v({ supplierName: ' ' }).length > 0, 'nome vazio recusado');
assert.ok(v({ supplierName: 'Ok', costPrice: -1 }).length > 0, 'custo negativo recusado');
assert.ok(v({ supplierName: 'Ok', supplierUrl: 'javascript:alert(1)' }).length > 0, 'url não http recusada');
assert.ok(v({ supplierName: 'Ok', leadTimeDays: 999 }).length > 0, 'prazo > 365 recusado');
assert.equal(v({ supplierName: 'Ok', supplierUrl: '', supplierSku: '' }).length, 0, 'vazios viram null');

assert.equal(grossMarginPct(100, 60), 40);
assert.equal(grossMarginPct(100, null), null);
assert.equal(grossMarginPct(0, 10), null);

const view = toProductSupplierView({
  productId: 'p', supplierName: 'F', supplierSku: null, supplierUrl: null,
  costPrice: '9.90', leadTimeDays: null, notes: null, updatedAt: new Date('2026-10-16T12:00:00Z'),
});
assert.equal(view.costPrice, 9.9);
assert.equal(view.updatedAt, '2026-10-16T12:00:00.000Z');

// Segurança: endpoints de fornecedor só no AdminController (@Roles('admin') na classe),
// e a vitrine pública nunca inclui a relação supplier.
const ctrl = readFileSync(join(__dirname, 'admin.controller.ts'), 'utf8');
assert.ok(/@Roles\('admin'\)\s*export class AdminController/.test(ctrl), 'controller inteiro admin-only');
assert.ok(ctrl.includes("@Put('products/:id/supplier')"));
assert.ok(ctrl.includes('UseInterceptors(AdminAuditInterceptor)'), 'PUT auditado');
for (const f of ['../catalog/catalog.controller.ts', '../storefront/storefront.service.ts']) {
  assert.ok(!readFileSync(join(__dirname, f), 'utf8').includes('supplier'), `${f} não pode ler fornecedor`);
}
console.log('product-supplier: PASSOU');
