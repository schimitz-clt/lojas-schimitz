import assert from 'node:assert/strict';
import {
  isQaCatalogCopy,
  publicProductDescription,
} from './public-copy';

assert.equal(isQaCatalogCopy(''), false);
assert.equal(isQaCatalogCopy('Tela 4K, apps de streaming e som potente.'), false);
assert.equal(
  isQaCatalogCopy(
    'Alarme residencial sem fio — produto do catálogo Lojas Schimitz na categoria Eletrônicos. Ideal para testar a experiência de compra da loja.',
  ),
  true,
);

const cleaned = publicProductDescription({
  description:
    'Alarme residencial sem fio — produto do catálogo Lojas Schimitz na categoria Eletrônicos. Ideal para testar a experiência de compra da loja.',
  name: 'Alarme residencial sem fio',
  categoryName: 'Eletrônicos',
});
assert.equal(cleaned.includes('Ideal para testar'), false);
assert.equal(cleaned.includes('Alarme residencial sem fio'), true);
assert.equal(cleaned.includes('Eletrônicos'), true);

const kept = publicProductDescription({
  description: 'Mais espaço e menos gelo. Economia no consumo.',
  name: 'Geladeira',
  categoryName: 'Eletrodomésticos',
});
assert.equal(kept, 'Mais espaço e menos gelo. Economia no consumo.');

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

console.log('public-copy tests ok');
