import assert from 'node:assert/strict';
import {
  COMPARE_MAX,
  addToCompare,
  compareBarLabel,
  compareCell,
  compareEmptyCopy,
  compareFullMessage,
  comparePageHeading,
  compareRows,
  compareToggleLabel,
  isCompared,
  mergeCompareSnapshot,
  parseCompareList,
  removeFromCompare,
  shouldShowCompareBar,
  snapshotFromProduct,
  toggleCompareItem,
} from './product-compare';

const a = snapshotFromProduct({
  id: '1',
  slug: 'tv-a',
  name: 'TV A',
  price: 1000,
  compareAtPrice: 1200,
  image: 'https://cdn.example/a.jpg',
  category: { name: 'TVs e Áudio' },
  seller: { name: 'Lojas Schimitz' },
  stock: 8,
  badge: 'Oferta',
});
const b = snapshotFromProduct({
  id: '2',
  slug: 'tv-b',
  name: 'TV B',
  price: '800',
  stock: 2,
});
const c = snapshotFromProduct({
  id: '3',
  slug: 'tv-c',
  name: 'TV C',
  price: 500,
  stock: 0,
});
const d = snapshotFromProduct({
  id: '4',
  slug: 'tv-d',
  name: 'TV D',
  price: 400,
});

assert.ok(a && b && c && d);
assert.equal(snapshotFromProduct({ name: 'nope' }), null);
assert.equal(a.price, 1000);
assert.equal(a.compareAtPrice, 1200);
assert.equal(a.categoryName, 'TVs e Áudio');
assert.equal(b.price, 800);

const parsed = parseCompareList([
  a,
  { id: '1', slug: 'dup', name: 'Dup' },
  { foo: 1 },
  null,
  b,
  c,
  d,
]);
assert.equal(parsed.length, COMPARE_MAX);
assert.deepEqual(
  parsed.map((x) => x.id),
  ['1', '2', '3'],
);

assert.equal(isCompared(parsed, '2'), true);
assert.equal(isCompared(parsed, '9'), false);

const addedDup = addToCompare([a], a);
assert.equal(addedDup.inList, true);
assert.equal(addedDup.list.length, 1);

const full = addToCompare([a, b, c], d);
assert.equal(full.reason, 'full');
assert.equal(full.inList, false);
assert.equal(full.list.length, 3);

const toggledOff = toggleCompareItem([a, b], a);
assert.equal(toggledOff.inList, false);
assert.equal(toggledOff.list.length, 1);
assert.equal(toggledOff.list[0].id, '2');

const toggledOn = toggleCompareItem([a], b);
assert.equal(toggledOn.inList, true);
assert.equal(toggledOn.list.length, 2);

assert.deepEqual(removeFromCompare([a, b], '1').map((x) => x.id), ['2']);

const merged = mergeCompareSnapshot(a, {
  id: '1',
  slug: 'tv-a',
  name: 'TV A nova',
  price: 900,
  stock: 1,
  category: { name: 'Eletro' },
});
assert.equal(merged.name, 'TV A nova');
assert.equal(merged.price, 900);
assert.equal(merged.stock, 1);
assert.equal(merged.categoryName, 'Eletro');

assert.ok(compareCell(a, 'price').includes('1.000'));
assert.ok(compareCell(a, 'pix').includes('950'));
assert.ok(/3x/.test(compareCell(a, 'installments')));
assert.equal(compareCell(a, 'seller'), 'Lojas Schimitz');
assert.equal(compareCell(a, 'category'), 'TVs e Áudio');
assert.equal(compareCell(a, 'stock'), 'Em estoque (8)');
assert.equal(compareCell(b, 'stock'), 'Últimas unidades (2)');
assert.equal(compareCell(c, 'stock'), 'Esgotado');
assert.equal(compareCell(a, 'badge'), 'Oferta');
assert.equal(compareCell(b, 'badge'), '—');

const rows = compareRows();
assert.equal(rows.length, 7);
assert.ok(rows.every((r) => r.id && r.label));

assert.equal(compareToggleLabel(false), 'Comparar');
assert.equal(compareToggleLabel(true), 'Na comparação');
assert.ok(compareFullMessage().includes('3'));
assert.ok(compareEmptyCopy().title.toLowerCase().includes('comparar'));
assert.equal(comparePageHeading(0).title, 'Comparar produtos');
assert.ok(comparePageHeading(2).subtitle.includes('2'));
assert.equal(compareBarLabel(1), '1 produto');
assert.equal(compareBarLabel(3), '3 produtos');

assert.equal(shouldShowCompareBar('/', 0), false);
assert.equal(shouldShowCompareBar('/', 2), true);
assert.equal(shouldShowCompareBar('/comparar', 2), false);
assert.equal(shouldShowCompareBar('/checkout', 2), false);
assert.equal(shouldShowCompareBar('/admin/catalogo', 2), false);
assert.equal(shouldShowCompareBar('/produto/tv-a', 1), true);
assert.equal(shouldShowCompareBar('/produtos', 3), true);

console.log('product-compare unit tests ok');
