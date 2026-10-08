import assert from 'node:assert/strict';
import { isQaCatalogCopy, publicProductDescription } from './public-description';

assert.equal(isQaCatalogCopy('Desempenho para estudo, trabalho e o dia a dia.'), false);
assert.equal(
  isQaCatalogCopy('Ideal para testar a experiência de compra da loja (busca, página do produto).'),
  true,
);

const out = publicProductDescription({
  description: 'Ideal para testar a experiência de compra da loja.',
  name: 'GPS automotivo 5"',
  categoryName: 'Eletrônicos',
});
assert.equal(out.includes('Ideal para testar'), false);
assert.match(out, /GPS automotivo/);

// Real product copy mentioning Anatel certification must stay visible.
const anatel = 'Smartphone 128 GB com homologação Anatel e garantia de 12 meses.';
assert.equal(isQaCatalogCopy(anatel), false);
assert.equal(
  publicProductDescription({ description: anatel, name: 'Smartphone', categoryName: 'Celulares' }),
  anatel,
);
// Actual QA/homologation text is still hidden.
assert.equal(isQaCatalogCopy('Produto de homologação — não comprar.'), true);
assert.equal(
  publicProductDescription({
    description: 'Produto de homologação — não comprar.',
    name: 'Smartphone',
    categoryName: 'Celulares',
  }).includes('homologação'),
  false,
);

console.log('public-description tests ok');
