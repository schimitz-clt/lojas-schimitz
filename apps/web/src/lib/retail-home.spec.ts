import assert from 'node:assert/strict';
import {
  bestsellerIdsFromShelves,
  configuredPromoLines,
  defaultPromoStripLines,
  offerCountdown,
  resolveRetailTrust,
  sellableCountFromCatalog,
  shouldUseRetailHome,
  visibleCatalogBadge,
} from './retail-home';

assert.equal(sellableCountFromCatalog({ sellableTotal: 3, total: 40 }), 3);
assert.equal(sellableCountFromCatalog([]), null);
assert.equal(shouldUseRetailHome(null), false);
assert.equal(shouldUseRetailHome(0), false);
assert.equal(shouldUseRetailHome(1), true);
assert.equal(shouldUseRetailHome(5), true);
assert.equal(shouldUseRetailHome(6), false);

{
  const ids = bestsellerIdsFromShelves({
    shelves: [
      { id: 'featured', metric: 'rating_count', items: [{ id: 'rated' }] },
      { id: 'offers', metric: 'deal', items: [{ id: 'deal' }] },
    ],
  });
  assert.equal(ids.has('rated'), false, 'rating rank is not Mais vendido');
  const paid = bestsellerIdsFromShelves({
    shelves: [{ id: 'featured', metric: 'paid_qty', title: 'Mais vendidos', items: [{ id: 'sold' }] }],
  });
  assert.equal(paid.has('sold'), true);
}

assert.equal(visibleCatalogBadge('Mais vendido', false), null);
assert.equal(visibleCatalogBadge('Mais vendido', true), 'Mais vendido');
assert.equal(visibleCatalogBadge('Oferta relâmpago', false), 'Oferta relâmpago');

assert.deepEqual(defaultPromoStripLines(), ['Frete grátis em POA', '5% OFF no PIX', 'Até 3x sem juros']);
assert.equal(configuredPromoLines(null), null);
assert.deepEqual(configuredPromoLines(['  Frete grátis em POA  ']), ['Frete grátis em POA']);

{
  const end = new Date('2026-09-26T15:00:30.000Z');
  const now = new Date('2026-09-26T12:00:00.000Z').getTime();
  const left = offerCountdown(end, now);
  assert.ok(left);
  assert.equal(left?.hours, 3);
  assert.equal(left?.seconds, 30);
  assert.equal(offerCountdown(end, end.getTime()), null);
  assert.equal(offerCountdown(null, now), null);
}

{
  const base = resolveRetailTrust({});
  assert.deepEqual(
    base.map((item) => item.id),
    ['frete', 'segura', 'troca'],
  );
  assert.equal(base.some((item) => /nota fiscal/i.test(item.title)), false);

  const withCnpj = resolveRetailTrust({ cnpj: '11222333000181' });
  assert.ok(withCnpj.some((item) => item.id === 'nota-fiscal'));
  assert.ok(withCnpj.some((item) => item.body.includes('11.222.333/0001-81')));

  const custom = resolveRetailTrust({
    cnpj: null,
    trustItems: [
      { title: 'Compra segura', body: 'Mercado Pago.' },
      { title: 'Nota fiscal', body: 'Inventada.' },
    ],
  });
  assert.equal(custom.length, 1);
  assert.equal(custom[0].title, 'Compra segura');
}

console.log('retail-home unit tests ok');
