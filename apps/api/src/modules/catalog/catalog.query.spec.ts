/**
 * Smoke tests for public /products query param parsing.
 */
import assert from 'assert';
import {
  buildProductOrderBy,
  buildProductWhere,
  parseMoneyBound,
  parsePage,
  parsePageSize,
  parseSort,
} from './catalog.query';

{
  assert.equal(parsePage(undefined), 1);
  assert.equal(parsePage('0'), 1);
  assert.equal(parsePage('3'), 3);
  assert.equal(parsePageSize(undefined), 24);
  assert.equal(parsePageSize('100'), 60);
  assert.equal(parsePageSize('12'), 12);
  console.log('catalog.query: pagination — PASSOU');
}

{
  assert.equal(parseSort(undefined), 'relevance');
  assert.equal(parseSort('PRICE_ASC'), 'price_asc');
  assert.equal(parseSort('newest'), 'newest');
  assert.equal(parseSort('nope'), 'relevance');
  console.log('catalog.query: sort — PASSOU');
}

{
  assert.equal(parseMoneyBound(undefined), undefined);
  assert.equal(parseMoneyBound(''), undefined);
  assert.equal(parseMoneyBound('-1'), undefined);
  assert.equal(parseMoneyBound('99,9'), 99.9);
  assert.equal(parseMoneyBound('10'), 10);
  console.log('catalog.query: money bounds — PASSOU');
}

{
  const where = buildProductWhere({ q: 'tv', category: 'eletro', minPrice: '100', maxPrice: '2000' });
  assert.equal(where.active, true);
  assert.deepEqual(where.category, { slug: 'eletro' });
  assert.deepEqual(where.price, { gte: 100, lte: 2000 });
  assert.ok(Array.isArray(where.OR));
  assert.ok(where.OR!.some((c) => 'description' in c));
  assert.ok(where.OR!.some((c) => 'name' in c));
  console.log('catalog.query: where q+category+price — PASSOU');
}

{
  const bare = buildProductWhere({});
  assert.equal(bare.active, true);
  assert.equal('OR' in bare, false);
  assert.equal('price' in bare, false);
  console.log('catalog.query: empty filters — PASSOU');
}

{
  assert.deepEqual(buildProductOrderBy('price_asc'), { price: 'asc' });
  assert.deepEqual(buildProductOrderBy('price_desc'), { price: 'desc' });
  assert.deepEqual(buildProductOrderBy('newest'), { createdAt: 'desc' });
  const rel = buildProductOrderBy('relevance');
  assert.ok(Array.isArray(rel));
  console.log('catalog.query: orderBy — PASSOU');
}

console.log('catalog.query.spec ok');
