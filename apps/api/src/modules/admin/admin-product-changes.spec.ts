/**
 * Auditoria de alteração de produto (preço/estoque/ativo): diff puro + serviço com fakes (sem banco).
 */
import assert from 'assert';
import { diffProductChanges } from './admin-product-changes';
import { AdminProductsService } from './admin-products.service';
import { AuditService } from '../../common/audit.service';

const before = {
  name: 'Tênis',
  sku: 'SKU-1',
  price: '100.00',
  compareAtPrice: null,
  active: true,
  badge: null,
  inventory: { qtyOnHand: 10 },
};

async function main() {
  // sem mudança → vazio
  assert.deepEqual(diffProductChanges(before, { price: 100, stock: 10, active: true, name: ' Tênis ' }), {});
  // com mudança
  const d = diffProductChanges(before, { price: 79.9, stock: 3, active: false, compareAtPrice: 120 });
  assert.deepEqual(d.price, { from: 100, to: 79.9 });
  assert.deepEqual(d.stock, { from: 10, to: 3 });
  assert.deepEqual(d.active, { from: true, to: false });
  assert.deepEqual(d.compareAtPrice, { from: null, to: 120 });
  assert.equal('name' in d, false);

  // serviço: update grava product.updated com ator e antes→depois
  const logs: any[] = [];
  const existing = { id: 'p1', ...before, images: [] };
  const prisma: any = {
    product: { findUnique: async () => existing },
    category: { findUnique: async () => ({}) },
    $transaction: async (fn: any) =>
      fn({
        product: { update: async () => ({ id: 'p1', sku: 'SKU-1', price: 79.9 }) },
        productImage: {},
      }),
  };
  const inventory: any = { setOnHandCas: async () => undefined };
  const audit: any = { log: async (a: string, o: any) => void logs.push({ a, o }) };
  const svc = new AdminProductsService(prisma, {} as any, inventory, audit);

  await svc.update('p1', { price: 79.9, stock: 3 } as any, 'admin-1');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].a, 'product.updated');
  assert.equal(logs[0].o.actorId, 'admin-1');
  assert.equal(logs[0].o.entityId, 'p1');
  assert.deepEqual(logs[0].o.meta.changes.price, { from: 100, to: 79.9 });
  assert.deepEqual(logs[0].o.meta.changes.stock, { from: 10, to: 3 });

  // nada mudou → não polui o log
  await svc.update('p1', { price: 100 } as any, 'admin-1');
  assert.equal(logs.length, 1);

  // falha do banco de auditoria (AuditService real) não quebra a edição do produto
  const realAudit = new AuditService({ auditLog: { create: async () => { throw new Error('db down'); } } } as any);
  const svc2 = new AdminProductsService(prisma, {} as any, inventory, realAudit);
  const r: any = await svc2.update('p1', { price: 50 } as any, 'a');
  assert.equal(r.id, 'p1');
  console.log('admin-product-changes tests ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
