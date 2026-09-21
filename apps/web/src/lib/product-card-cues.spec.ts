import assert from 'node:assert/strict';
import { productCardAddLabel, productCardCues, productCardKicker } from './product-card-cues';

const cues = productCardCues();
assert.equal(cues.length, 3);
assert.deepEqual(
  cues.map((c) => c.id),
  ['pix', 'install', 'ship'],
);
assert.ok(cues.every((c) => c.label && c.tone));
assert.ok(/PIX/i.test(cues[0].label));
assert.ok(/3x/.test(cues[1].label));
assert.ok(/Frete/i.test(cues[2].label));
assert.ok(!/12x/.test(cues.map((c) => c.label).join(' ')));

assert.equal(productCardKicker('Celulares', 'Loja'), 'Celulares');
assert.equal(productCardKicker('  ', 'Schimitz'), 'Schimitz');
assert.equal(productCardKicker(null, null), null);
assert.equal(productCardKicker('', ''), null);

assert.equal(
  productCardAddLabel({ outOfStock: false, adding: false, added: false }),
  'Adicionar à sacola',
);
assert.equal(
  productCardAddLabel({ outOfStock: false, adding: true, added: false }),
  'Adicionando…',
);
assert.equal(
  productCardAddLabel({ outOfStock: false, adding: false, added: true }),
  '✓ Na sacola',
);
assert.equal(
  productCardAddLabel({ outOfStock: true, adding: false, added: false }),
  'Ver detalhes',
);

console.log('product-card-cues unit tests ok');
