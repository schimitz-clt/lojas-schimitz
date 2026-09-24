import assert from 'node:assert/strict';
import {
  buildBreadcrumbList,
  buildProductJsonLd,
  buildStoreJsonLd,
  formatOfferPrice,
  itemCondition,
  offerAvailability,
  schemaImageUrl,
  schemaTelephone,
  stringifyJsonLd,
} from './json-ld';

assert.equal(formatOfferPrice(1790), '1790.00');
assert.equal(formatOfferPrice('1790'), '1790.00');
assert.equal(formatOfferPrice('99.9'), '99.90');
assert.equal(formatOfferPrice(-1), '0');

assert.equal(offerAvailability(5), 'https://schema.org/InStock');
assert.equal(offerAvailability(0), 'https://schema.org/OutOfStock');
assert.equal(offerAvailability(null), 'https://schema.org/LimitedAvailability');
assert.equal(offerAvailability(undefined), 'https://schema.org/LimitedAvailability');

assert.equal(itemCondition('new'), 'https://schema.org/NewCondition');
assert.equal(itemCondition('used'), 'https://schema.org/UsedCondition');
assert.equal(itemCondition(null), 'https://schema.org/NewCondition');

const origin = 'https://lojasschimitz.com.br';

const crumbs = buildBreadcrumbList(origin, [
  { name: 'Início', path: '/' },
  { name: 'TVs e Áudio', path: '/departamento/eletro' },
  { name: 'Ar-condicionado aiwa', path: '/produto/ar-condicionado-aiwa-2' },
]);
assert.equal(crumbs['@type'], 'BreadcrumbList');
const els = crumbs.itemListElement as { position: number; name: string; item: string }[];
assert.equal(els.length, 3);
assert.equal(els[0].position, 1);
assert.equal(els[0].item, 'https://lojasschimitz.com.br/');
assert.equal(els[1].item, 'https://lojasschimitz.com.br/departamento/eletro');
assert.equal(els[2].name, 'Ar-condicionado aiwa');

const product = buildProductJsonLd(origin, {
  name: 'Ar-condicionado aiwa',
  description: '12.000 btu Wifi inverter',
  slug: 'ar-condicionado-aiwa-2',
  sku: 'ARCONDIC-UCHHBH',
  price: '1790',
  image: 'https://lojasschimitz.com.br/api/v1/uploads/x.png',
  stock: 5,
  condition: 'new',
  sellerName: 'Lojas Schimitz',
  ratingAvg: 0,
  ratingCount: 0,
});
assert.equal(product['@type'], 'Product');
assert.equal(product.sku, 'ARCONDIC-UCHHBH');
assert.equal((product.offers as { price: string }).price, '1790.00');
assert.equal(
  (product.offers as { availability: string }).availability,
  'https://schema.org/InStock',
);
assert.equal(
  (product.offers as { priceCurrency: string }).priceCurrency,
  'BRL',
);
assert.ok(!('aggregateRating' in product));

const rated = buildProductJsonLd(origin, {
  name: 'X',
  description: 'Y',
  slug: 'x',
  price: 10,
  stock: 1,
  ratingAvg: '4.5',
  ratingCount: 3,
});
assert.deepEqual(rated.aggregateRating, {
  '@type': 'AggregateRating',
  ratingValue: 4.5,
  reviewCount: 3,
  bestRating: 5,
  worstRating: 1,
});

const raw = stringifyJsonLd({ a: '</script><script>alert(1)' });
assert.ok(!raw.includes('</script>'));
assert.ok(raw.includes('\\u003c'));

// Apex only — builders must not emit www host when origin is apex
const wwwGuard = buildBreadcrumbList('https://lojasschimitz.com.br', [
  { name: 'Início', path: '/' },
]);
const first = (wwwGuard.itemListElement as { item: string }[])[0].item;
assert.ok(!first.includes('www.'));
assert.ok(first.startsWith('https://lojasschimitz.com.br'));

assert.equal(
  schemaImageUrl(origin, '/api/v1/uploads/x.png'),
  'https://lojasschimitz.com.br/api/v1/uploads/x.png',
);
assert.equal(schemaImageUrl(origin, 'https://placehold.co/600x400.png'), null);
assert.equal(schemaImageUrl(origin, `${origin}/`), null);
assert.equal(schemaTelephone('5551996253766'), '+5551996253766');
assert.equal(schemaTelephone('123'), null);

const relativePhoto = buildProductJsonLd(origin, {
  name: 'Smart TV',
  description: 'TV',
  slug: 'smart-tv',
  price: '1999.9',
  image: '/api/v1/uploads/tv.jpg',
  stock: 2,
});
assert.equal(relativePhoto.image, 'https://lojasschimitz.com.br/api/v1/uploads/tv.jpg');

const noPhoto = buildProductJsonLd(origin, {
  name: 'Alarme',
  description: 'Sem foto',
  slug: 'alarme',
  price: '10',
  image: 'https://placehold.co/600x400.png',
  stock: 1,
});
assert.ok(!('image' in noPhoto));

const store = buildStoreJsonLd(origin, {
  name: 'Lojas Schimitz',
  description: 'Eletro, celulares e casa em Porto Alegre.',
  logoUrl: '/android-chrome-512x512.png',
  telephone: '5551996253766',
});
assert.equal(store.length, 2);
assert.equal(store[0]['@type'], 'Organization');
assert.equal(store[1]['@type'], 'WebSite');
assert.equal(store[1].inLanguage, 'pt-BR');
assert.equal(store[0].logo, 'https://lojasschimitz.com.br/android-chrome-512x512.png');
const action = store[1].potentialAction as { target: { urlTemplate: string } };
assert.equal(
  action.target.urlTemplate,
  'https://lojasschimitz.com.br/produtos?q={search_term_string}',
);
assert.ok(!String(store[0].url).includes('www.'));
const contact = store[0].contactPoint as { telephone: string };
assert.equal(contact.telephone, '+5551996253766');

console.log('json-ld unit tests ok');
