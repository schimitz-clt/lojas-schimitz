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

console.log('public-description tests ok');
