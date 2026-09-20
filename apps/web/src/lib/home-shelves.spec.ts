import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  catalogProductsFromResponse,
  featuredShelfCopy,
  homeShelfScrollAmount,
  isOfferProduct,
  parseHomeShelvesPayload,
  pickFeaturedFromCatalog,
  pickNewestProducts,
  pickOfferProducts,
  shelvesFromCatalog,
  visibleHomeShelves,
} from './home-shelves';

type P = {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number | null;
  badge?: string | null;
  ratingCount?: number;
  createdAt?: string;
};

function p(partial: Partial<P> & Pick<P, 'id'>): P {
  return {
    name: partial.name || partial.id,
    slug: partial.slug || partial.id,
    price: partial.price ?? 100,
    ...partial,
  };
}

{
  assert.equal(isOfferProduct(p({ id: '1', price: 80, compareAtPrice: 100 })), true);
  assert.equal(isOfferProduct(p({ id: '2', price: 100, compareAtPrice: 80 })), false);
  assert.equal(isOfferProduct(p({ id: '3', price: 100, badge: 'Oferta' })), true);
  const offers = pickOfferProducts([
    p({ id: 'tv', price: 200, compareAtPrice: 280 }),
    p({ id: 'cheap', price: 20 }),
    p({ id: 'badge', price: 90, badge: 'Selo' }),
  ]);
  assert.equal(offers.metric, 'deal');
  assert.deepEqual(
    offers.items.map((x) => x.id),
    ['tv', 'badge'],
  );
  const cheap = pickOfferProducts([p({ id: 'b', price: 30 }), p({ id: 'a', price: 10 })]);
  assert.equal(cheap.metric, 'lowest_price');
  assert.equal(cheap.items[0].id, 'a');
  console.log('web home-shelves: offers — PASSOU');
}

{
  const newest = pickNewestProducts([
    p({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' }),
    p({ id: 'new', createdAt: '2026-09-01T00:00:00.000Z' }),
  ]);
  assert.equal(newest[0].id, 'new');
  const featured = pickFeaturedFromCatalog([
    p({ id: 'r', ratingCount: 4, createdAt: '2026-01-01' }),
    p({ id: 'z', ratingCount: 0, createdAt: '2026-09-01' }),
  ]);
  assert.equal(featured.metric, 'rating_count');
  assert.deepEqual(
    featured.items.map((x) => x.id),
    ['r'],
  );
  const noRatings = pickFeaturedFromCatalog([
    p({ id: 'z', createdAt: '2026-09-01' }),
    p({ id: 'a', createdAt: '2026-01-01' }),
  ]);
  assert.equal(noRatings.metric, 'newest');
  assert.equal(noRatings.items[0].id, 'z');
  console.log('web home-shelves: newest/featured fallback — PASSOU');
}

{
  assert.equal(featuredShelfCopy('paid_qty').title, 'Mais vendidos');
  assert.equal(featuredShelfCopy('rating_count').title, 'Mais vendidos');
  assert.equal(featuredShelfCopy('newest').title, 'Em destaque');
  const built = shelvesFromCatalog([
    p({ id: 'deal', price: 90, compareAtPrice: 120, createdAt: '2026-01-01' }),
    p({ id: 'fresh', price: 40, createdAt: '2026-09-01' }),
  ]);
  assert.equal(built[0].title, 'Ofertas');
  assert.equal(built[1].title, 'Novidades');
  assert.ok(built[2].title === 'Em destaque' || built[2].title === 'Mais vendidos');
  console.log('web home-shelves: copy — PASSOU');
}

{
  const parsed = parseHomeShelvesPayload({
    shelves: [
      { id: 'offers', title: 'Ofertas', items: [p({ id: 'a' })] },
      { id: 'newest', title: 'Novidades', items: [] },
      { id: 'nope', title: 'X', items: [p({ id: 'b' })] },
    ],
  });
  assert.ok(parsed);
  assert.equal(parsed!.length, 2);
  assert.deepEqual(
    visibleHomeShelves(parsed).map((s) => s.id),
    ['offers'],
  );
  assert.equal(parseHomeShelvesPayload(null), null);
  assert.deepEqual(catalogProductsFromResponse({ items: [p({ id: 'x' }), { name: 'no-id' }] }).map((x) => x.id), [
    'x',
  ]);
  console.log('web home-shelves: parse + hide empty — PASSOU');
}

{
  assert.equal(homeShelfScrollAmount(400), Math.max(180, Math.round(400 * 0.72)));
  assert.equal(homeShelfScrollAmount(0), 220);
  console.log('web home-shelves: scroll — PASSOU');
}

{
  const page = readFileSync(join(__dirname, '../app/page.tsx'), 'utf8');
  assert.ok(page.includes('HomeShelves'), 'home renders dedicated shelves');
  assert.ok(page.includes('/store/shelves'), 'home fetches GET /store/shelves');
  assert.ok(!page.includes('Recomendados para você'), 'removed fake recommendations rail');
  const cmp = readFileSync(join(__dirname, '../components/HomeShelves.tsx'), 'utf8');
  assert.ok(cmp.includes('ProductCard'), 'rails reuse ProductCard (PIX 5%)');
  assert.ok(cmp.includes('visibleHomeShelves'), 'empty rails stay hidden');
  assert.ok(cmp.includes('scroll-snap') || cmp.includes('home-shelf-rail'), 'horizontal snap rail');
  assert.ok(!/mockProducts|fakeProducts|lorem/i.test(cmp));
  console.log('web home-shelves: source lock — PASSOU');
}

console.log('home-shelves unit tests ok');
