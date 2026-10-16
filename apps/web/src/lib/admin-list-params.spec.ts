import assert from 'assert';
import { paginate, parseOrderSort, parsePage, sortOrders, sortProducts, textMatch, withListParams } from './admin-list-params';

assert.equal(withListParams('pagina=3&x=1', { status: 'paid' }), '?x=1&status=paid', 'filtro volta à página 1 e preserva o resto');
assert.equal(withListParams('status=paid', { pagina: 2 }), '?status=paid&pagina=2');
assert.equal(withListParams('status=paid&pagina=2', { pagina: 1 }), '?status=paid');
assert.equal(withListParams('busca=abc', { busca: '' }), '');
assert.equal(parsePage('0'), 1);
assert.equal(parsePage('4'), 4);
const p = paginate(Array.from({ length: 60 }, (_, i) => i), 3, 25);
assert.deepEqual([p.page, p.pages, p.from, p.to, p.rows.length], [3, 3, 51, 60, 10]);
assert.equal(paginate([], 5).page, 1);
assert.equal(paginate([1, 2], 9).page, 1, 'página fora do limite volta ao máximo');
assert.equal(parseOrderSort('x'), 'recentes');
const o = [{ id: 'a', createdAt: '2026-10-01', total: '10' }, { id: 'b', createdAt: '2026-10-05', total: '5' }];
assert.equal(sortOrders(o, 'recentes')[0].id, 'b');
assert.equal(sortOrders(o, 'maior_valor')[0].id, 'a');
const pr = [{ name: 'Ventilador', price: 100, inventory: { qtyOnHand: 1 } }, { name: 'Air fryer', price: 300, inventory: { qtyOnHand: 9 } }];
assert.equal(sortProducts(pr, 'nome')[0].name, 'Air fryer');
assert.equal(sortProducts(pr, 'estoque_baixo')[0].name, 'Ventilador');
assert.ok(textMatch(['Air Fryer', 'SKU-1'], 'fryer'));
assert.ok(!textMatch(['x'], 'y'));
console.log('admin-list-params: PASSOU');
import { sortCustomers } from './admin-list-params';
{
  const c = [{ name: 'Bia', lastOrderAt: '2026-10-01', paidTotal: '50', ordersCount: 3 }, { name: 'Ana', lastOrderAt: null, paidTotal: '90', ordersCount: 1 }];
  assert.equal(sortCustomers(c, 'recentes')[0].name, 'Bia');
  assert.equal(sortCustomers(c, 'maior_gasto')[0].name, 'Ana');
  assert.equal(sortCustomers(c, 'nome')[0].name, 'Ana');
  console.log('admin-list-params clientes: PASSOU');
}
import { financePeriodFrom, parseFinancePeriod } from './admin-list-params';
{
  assert.equal(parseFinancePeriod(null), '30d');
  assert.equal(parseFinancePeriod('tudo'), 'tudo');
  assert.equal(financePeriodFrom('tudo'), null);
  const now = new Date('2026-10-16T12:00:00Z');
  assert.equal(financePeriodFrom('30d', now), '2026-09-16T12:00:00.000Z');
  assert.equal(financePeriodFrom('7d', now), '2026-10-09T12:00:00.000Z');
  console.log('admin-list-params financeiro: PASSOU');
}
import { sortBy } from './admin-list-params';
assert.deepEqual(sortBy([{ n: 'b' }, { n: 'a' }], (r) => r.n).map((r) => r.n), ['a', 'b']);
assert.deepEqual(sortBy([{ n: 1 }, { n: 3 }], (r) => r.n, 'desc').map((r) => r.n), [3, 1]);
assert.equal(withListParams('area=products', { acao: 'PATCH' }), '?area=products&acao=PATCH');
console.log('admin-list-params sortBy: PASSOU');
