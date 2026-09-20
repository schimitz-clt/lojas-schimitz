import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HOME_SHELF_LIMIT,
  assembleHomeShelves,
  featuredShelfCopy,
  hasSoldQty,
  isOfferProduct,
  newestShelfCopy,
  offerDiscountRatio,
  offersShelfCopy,
  pickFeaturedProducts,
  pickNewestProducts,
  pickOfferProducts,
  soldQtyMap,
  visibleHomeShelves,
} from './home-shelves';

type P = {
  id: string;
  price: number;
  compareAtPrice?: number | null;
  badge?: string | null;
  ratingCount?: number;
  createdAt?: string;
};

function p(partial: P): P {
  return partial;
}

{
  assert.equal(HOME_SHELF_LIMIT, 12);
  assert.equal(isOfferProduct(p({ id: '1', price: 80, compareAtPrice: 100 })), true);
  assert.equal(isOfferProduct(p({ id: '2', price: 100, compareAtPrice: 80 })), false);
  assert.equal(isOfferProduct(p({ id: '3', price: 100, compareAtPrice: 100 })), false);
  assert.equal(isOfferProduct(p({ id: '4', price: 100, badge: 'Oferta' })), true);
  assert.equal(isOfferProduct(p({ id: '5', price: 100, badge: '  ' })), false);
  assert.equal(isOfferProduct(p({ id: '6', price: 100 })), false);
  assert.ok(offerDiscountRatio(p({ id: '1', price: 80, compareAtPrice: 100 })) > 0.19);
  assert.equal(offerDiscountRatio(p({ id: '2', price: 100 })), 0);
  console.log('home-shelves: offer detection — PASSOU');
}

{
  const catalog = [
    p({ id: 'tv', price: 2299.9, compareAtPrice: 2799.9, createdAt: '2026-01-01' }),
    p({ id: 'nb', price: 3199, compareAtPrice: 3699, createdAt: '2026-01-02' }),
    p({ id: 'cheap', price: 49.9, createdAt: '2026-01-03' }),
    p({ id: 'mid', price: 199, badge: 'Selo', createdAt: '2026-01-04' }),
  ];
  const offers = pickOfferProducts(catalog, 10);
  assert.equal(offers.metric, 'deal');
  assert.deepEqual(
    offers.items.map((x) => x.id),
    ['tv', 'nb', 'mid'],
  );
  assert.ok(!offers.items.some((x) => x.id === 'cheap'), 'no fake % on cheapest without deal');

  const noDeals = pickOfferProducts(
    [p({ id: 'a', price: 300 }), p({ id: 'b', price: 10 }), p({ id: 'c', price: 80 })],
    2,
  );
  assert.equal(noDeals.metric, 'lowest_price');
  assert.deepEqual(
    noDeals.items.map((x) => x.id),
    ['b', 'c'],
  );
  console.log('home-shelves: offer ranking — PASSOU');
}

{
  const newest = pickNewestProducts(
    [
      p({ id: 'old', price: 1, createdAt: '2026-01-01T00:00:00.000Z' }),
      p({ id: 'new', price: 1, createdAt: '2026-09-01T00:00:00.000Z' }),
      p({ id: 'mid', price: 1, createdAt: '2026-06-01T00:00:00.000Z' }),
    ],
    2,
  );
  assert.deepEqual(
    newest.map((x) => x.id),
    ['new', 'mid'],
  );
  console.log('home-shelves: newest — PASSOU');
}

{
  const catalog = [
    p({ id: 'a', price: 10, ratingCount: 2, createdAt: '2026-01-01' }),
    p({ id: 'b', price: 20, ratingCount: 0, createdAt: '2026-02-01' }),
    p({ id: 'c', price: 30, ratingCount: 8, createdAt: '2026-03-01' }),
  ];

  const bySales = pickFeaturedProducts(catalog, soldQtyMap([{ productId: 'b', qty: 4 }, { productId: 'a', qty: 1 }]));
  assert.equal(bySales.metric, 'paid_qty');
  assert.deepEqual(
    bySales.items.map((x) => x.id),
    ['b', 'a'],
  );
  assert.ok(!bySales.items.some((x) => x.id === 'c'), 'un-sold products stay off the sales rail');

  const byRating = pickFeaturedProducts(catalog, soldQtyMap([]));
  assert.equal(byRating.metric, 'rating_count');
  assert.deepEqual(
    byRating.items.map((x) => x.id),
    ['c', 'a'],
  );

  const none = pickFeaturedProducts(
    [p({ id: 'x', price: 1, createdAt: '2026-01-01' }), p({ id: 'y', price: 1, createdAt: '2026-08-01' })],
    soldQtyMap(null),
  );
  assert.equal(none.metric, 'newest');
  assert.deepEqual(
    none.items.map((x) => x.id),
    ['y', 'x'],
  );
  console.log('home-shelves: featured ranking — PASSOU');
}

{
  assert.equal(offersShelfCopy('deal').title, 'Ofertas');
  assert.ok(!/\d+\s*%/.test(offersShelfCopy('lowest_price').subtitle), 'no invented discount %');
  assert.ok(offersShelfCopy('lowest_price').subtitle.includes('sem promoção'));
  assert.equal(newestShelfCopy().title, 'Novidades');
  assert.equal(featuredShelfCopy('paid_qty').title, 'Mais vendidos');
  assert.equal(featuredShelfCopy('rating_count').title, 'Mais vendidos');
  assert.equal(featuredShelfCopy('newest').title, 'Em destaque');
  assert.ok(!featuredShelfCopy('newest').title.includes('Mais vendidos'));
  console.log('home-shelves: honest titles — PASSOU');
}

{
  const empty = visibleHomeShelves([
    { id: 'offers', items: [] },
    { id: 'newest', items: [{ id: '1' }] },
    { id: 'featured', items: [] },
  ]);
  assert.deepEqual(
    empty.map((s) => s.id),
    ['newest'],
  );
  assert.deepEqual(visibleHomeShelves([]), []);
  console.log('home-shelves: hide empty — PASSOU');
}

{
  const shelves = assembleHomeShelves(
    [
      p({ id: 'deal', price: 90, compareAtPrice: 120, createdAt: '2026-01-01', ratingCount: 0 }),
      p({ id: 'fresh', price: 40, createdAt: '2026-09-01', ratingCount: 0 }),
    ],
    [{ productId: 'deal', qty: 3 }],
    4,
  );
  assert.equal(shelves.length, 3);
  assert.equal(shelves[0].title, 'Ofertas');
  assert.equal(shelves[1].title, 'Novidades');
  assert.equal(shelves[2].title, 'Mais vendidos');
  assert.equal(shelves[2].metric, 'paid_qty');
  assert.ok(hasSoldQty(soldQtyMap([{ productId: 'deal', qty: 3 }])));
  assert.equal(hasSoldQty(soldQtyMap([{ productId: 'x', qty: 0 }])), false);
  console.log('home-shelves: assemble — PASSOU');
}

{
  const ctrl = readFileSync(join(__dirname, 'storefront.controller.ts'), 'utf8');
  assert.ok(ctrl.includes("Get('store/shelves')"), 'public GET /store/shelves');
  const svc = readFileSync(join(__dirname, 'storefront.service.ts'), 'utf8');
  assert.ok(svc.includes('assembleHomeShelves'), 'service uses pure assembler');
  assert.ok(svc.includes('PAID_REVENUE_STATUSES'), 'sales from paid orders only');
  assert.ok(!/mock product|lorem ipsum|fake sku/i.test(svc));
  console.log('home-shelves: source lock — PASSOU');
}

console.log('storefront home-shelves unit tests ok');
