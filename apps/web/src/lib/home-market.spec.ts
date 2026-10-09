import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOME_MARKET_CATALOG_PATH, buildHomeMarketSeed, unwrapApiData } from './home-market';

const p = (i: number, extra: Record<string, unknown> = {}) => ({
  id: `p${i}`,
  name: `Produto ${i}`,
  slug: `produto-${i}`,
  price: 100 + i,
  createdAt: new Date(2026, 0, i + 1).toISOString(),
  ...extra,
});
const items = Array.from({ length: 12 }, (_, i) => p(i, i < 3 ? { compareAtPrice: 500 } : {}));

// Envelope unwrap (API returns { ok, data, meta }).
assert.deepEqual(unwrapApiData({ ok: true, data: { items: [1] } }), { items: [1] });
assert.deepEqual(unwrapApiData([1, 2]), [1, 2]);

// Market catalog (> 5 sellable) → seed with products, count and shelves from the catalog fallback.
const market = buildHomeMarketSeed({ items, total: 12, sellableTotal: 12 }, null)!;
assert.ok(market, 'market catalog seeds the home');
assert.equal(market.products.length, 12);
assert.equal(market.activeCount, 12);
assert.ok(market.shelves.length > 0 && market.shelves.some((s) => s.items.length > 0), 'shelves from catalog');

// /store/shelves payload wins over the catalog fallback.
const fromApi = buildHomeMarketSeed(
  { items, total: 12, sellableTotal: 12 },
  { shelves: [{ id: 'newest', title: 'Novidades', items: [items[5]] }] },
)!;
assert.equal(fromApi.shelves.length, 1);
assert.equal(fromApi.shelves[0].items[0].slug, 'produto-5');

// Retail (1–5 sellable), empty or broken payload → null (client decides, as before).
assert.equal(buildHomeMarketSeed({ items: items.slice(0, 3), total: 3, sellableTotal: 3 }, null), null);
assert.equal(buildHomeMarketSeed({ items: [], total: 0, sellableTotal: 0 }, null), null);
assert.equal(buildHomeMarketSeed(null, null), null);
assert.equal(buildHomeMarketSeed('x', null), null);

// Wiring: the server fetches the same path the client uses and passes the seed down.
const page = readFileSync(join(__dirname, '../app/page.tsx'), 'utf8');
assert.ok(page.includes('loadMarketSeed()'), 'page.tsx loads the market seed on the server');
assert.ok(page.includes('initialMarket={market}'), 'page.tsx passes the seed to the client');
assert.ok(page.includes('HOME_MARKET_CATALOG_PATH'));
const client = readFileSync(join(__dirname, '../app/home-client.tsx'), 'utf8');
assert.ok(client.includes(': HOME_MARKET_CATALOG_PATH;'), 'client fetches the same catalog path');
assert.ok(client.includes('skipMarketFetch'), 'client skips the first fetch when seeded');
assert.ok(/useState<Product\[\]>\(seededMarket\?\.products/.test(client), 'client starts with the server products');

console.log('home-market.spec OK');
