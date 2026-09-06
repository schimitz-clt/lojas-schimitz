/**
 * Smoke + behavioral tests for public /products query param parsing.
 * price_asc / price_desc must order by numeric price (Decimal), not lexical strings.
 */
import assert from 'assert';
import { Prisma } from '@prisma/client';
import {
  buildProductOrderBy,
  buildProductWhere,
  parseMoneyBound,
  parsePage,
  parsePageSize,
  parseSort,
  sortProductsByNumericPrice,
  toNumericPrice,
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
  assert.equal(parseSort('price_desc'), 'price_desc');
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
  assert.equal(parseMoneyBound('2.005'), 2.01); // cents round for Decimal(12,2)
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
  const onlyMin = buildProductWhere({ minPrice: '2' });
  assert.deepEqual(onlyMin.price, { gte: 2 });
  const onlyMax = buildProductWhere({ maxPrice: '900' });
  assert.deepEqual(onlyMax.price, { lte: 900 });
  const cat = buildProductWhere({ category: 'esporte' });
  assert.deepEqual(cat.category, { slug: 'esporte' });
  console.log('catalog.query: min/max/category filters — PASSOU');
}

{
  const asc = buildProductOrderBy('price_asc');
  const desc = buildProductOrderBy('price_desc');
  assert.ok(Array.isArray(asc));
  assert.ok(Array.isArray(desc));
  assert.deepEqual(asc[0], { price: 'asc' });
  assert.deepEqual(desc[0], { price: 'desc' });
  assert.notDeepEqual(asc, desc, 'price_asc and price_desc must differ');
  assert.deepEqual(buildProductOrderBy('newest')[0], { createdAt: 'desc' });
  const rel = buildProductOrderBy('relevance');
  assert.ok(Array.isArray(rel));
  assert.deepEqual(rel[0], { ratingCount: 'desc' });
  console.log('catalog.query: orderBy shape — PASSOU');
}

{
  // Decimal-like values that FAIL under lexical string sort ("10" < "2").
  const sample = [
    { name: 'Notebook', price: new Prisma.Decimal('3199') },
    { name: 'Roblox', price: new Prisma.Decimal('2') },
    { name: 'Aspirador', price: new Prisma.Decimal('899') },
    { name: 'Dez reais', price: new Prisma.Decimal('10') },
    { name: 'Cem reais', price: new Prisma.Decimal('100') },
    { name: 'Tênis', price: new Prisma.Decimal('249.9') },
  ];

  assert.equal(toNumericPrice(sample[1].price), 2);
  assert.equal(toNumericPrice('249,9'), 249.9);

  const asc = sortProductsByNumericPrice(sample, 'asc');
  assert.equal(asc[0].name, 'Roblox', 'price_asc: lowest (R$2 Roblox) first');
  assert.equal(toNumericPrice(asc[0].price), 2);
  assert.equal(asc[1].name, 'Dez reais');
  assert.equal(asc[2].name, 'Cem reais');
  assert.equal(asc[asc.length - 1].name, 'Notebook', 'price_asc: highest last');

  const desc = sortProductsByNumericPrice(sample, 'desc');
  assert.equal(desc[0].name, 'Notebook', 'price_desc: highest first');
  assert.equal(toNumericPrice(desc[0].price), 3199);
  assert.equal(desc[desc.length - 1].name, 'Roblox', 'price_desc: Roblox R$2 last');

  // Prove lexical string sort would be wrong (regression guard).
  const lexical = [...sample].sort((a, b) => String(a.price).localeCompare(String(b.price)));
  assert.notEqual(lexical[0].name, 'Roblox', 'lexical sort must not put R$2 first');
  assert.equal(asc[0].name, 'Roblox');

  // orderBy from query helpers must request numeric price directions.
  assert.deepEqual(buildProductOrderBy(parseSort('price_asc'))[0], { price: 'asc' });
  assert.deepEqual(buildProductOrderBy(parseSort('price_desc'))[0], { price: 'desc' });

  console.log('catalog.query: price_asc lowest / price_desc highest (Decimal) — PASSOU');
}

console.log('catalog.query.spec ok');
