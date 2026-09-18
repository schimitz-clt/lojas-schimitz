import assert from 'node:assert/strict';
import {
  RECENT_MAX,
  clearRecentList,
  parseRecentList,
  recentClearLabel,
  recentListExcluding,
  recentStripHeading,
  rememberViewed,
  removeFromRecent,
  shouldShowRecentStrip,
  snapshotRecentProduct,
} from './recently-viewed';

const a = snapshotRecentProduct({
  id: '1',
  slug: 'tv-a',
  name: 'TV A',
  price: 1000,
  compareAtPrice: 1200,
  image: 'https://cdn.example/a.jpg',
  category: { name: 'TVs e Áudio' },
});
const b = snapshotRecentProduct({
  id: '2',
  slug: 'tv-b',
  name: 'TV B',
  price: '800',
});
assert.ok(a && b);
assert.equal(snapshotRecentProduct({ name: 'nope' }), null);
assert.equal(a.price, 1000);
assert.equal(a.compareAtPrice, 1200);
assert.equal(a.categoryName, 'TVs e Áudio');

const parsed = parseRecentList([
  { ...a, viewedAt: 10 },
  { id: '1', slug: 'dup', name: 'Dup', viewedAt: 1 },
  { foo: 1 },
  null,
  { ...b, viewedAt: 20 },
]);
assert.equal(parsed.length, 2);
assert.deepEqual(
  parsed.map((x) => x.id),
  ['2', '1'],
);

const remembered = rememberViewed(parsed, a, 30);
assert.equal(remembered[0].id, '1');
assert.equal(remembered[0].viewedAt, 30);
assert.equal(remembered.length, 2);

const many = Array.from({ length: 16 }, (_, i) =>
  snapshotRecentProduct({
    id: String(i + 1),
    slug: `p-${i + 1}`,
    name: `Produto ${i + 1}`,
    price: 10 + i,
  }),
).filter((x): x is NonNullable<typeof x> => Boolean(x));
let list = [] as typeof many;
for (let i = 0; i < many.length; i++) {
  list = rememberViewed(list, many[i], i + 1);
}
assert.equal(list.length, RECENT_MAX);
assert.equal(list[0].id, '16');
assert.ok(!list.some((x) => x.id === '1'));

assert.deepEqual(removeFromRecent(remembered, '1').map((x) => x.id), ['2']);
assert.deepEqual(recentListExcluding(remembered, '1').map((x) => x.id), ['2']);
assert.deepEqual(recentListExcluding(remembered, null, 'tv-b').map((x) => x.id), ['1']);

assert.equal(recentStripHeading(0).title, 'Vistos recentemente');
assert.equal(recentStripHeading(1).subtitle, '1 produto');
assert.ok(recentStripHeading(4).subtitle.includes('4'));
assert.equal(recentClearLabel(), 'Limpar histórico');

assert.equal(shouldShowRecentStrip('/', 0), false);
assert.equal(shouldShowRecentStrip('/', 2), true);
assert.equal(shouldShowRecentStrip('/produtos', 1), true);
assert.equal(shouldShowRecentStrip('/produto/tv-a', 3), true);
assert.equal(shouldShowRecentStrip('/checkout', 2), false);
assert.equal(shouldShowRecentStrip('/carrinho', 2), false);
assert.equal(shouldShowRecentStrip('/admin/catalogo', 2), false);
assert.equal(shouldShowRecentStrip('/entrar', 2), false);

const cleared = parseRecentList([]);
assert.equal(cleared.length, 0);
assert.equal(clearRecentList().length, 0);

console.log('recently-viewed unit tests ok');
