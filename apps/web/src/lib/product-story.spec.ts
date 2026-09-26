import assert from 'node:assert/strict';
import {
  faqToText,
  parseProductStory,
  textToFaq,
  textToFeatures,
  textToHighlights,
  textToTrustItems,
} from './product-story';

{
  const story = parseProductStory({
    highlights: ['Leve'],
    features: [{ label: 'Peso', value: '250 g' }],
    boxContents: [],
    faq: [],
  });
  assert.deepEqual(story.highlights, ['Leve']);
  assert.deepEqual(story.features, [{ label: 'Peso', value: '250 g' }]);
  assert.equal(story.boxContents.length, 0);
  assert.equal(story.faq.length, 0);
  assert.deepEqual(parseProductStory(null).highlights, []);
}

assert.deepEqual(textToHighlights('A\n\nB'), ['A', 'B']);
assert.deepEqual(textToFeatures('Bateria | 40 h\nruim'), [{ label: 'Bateria', value: '40 h' }]);
assert.equal(faqToText(textToFaq('Garantia? | 7 dias de troca.')), 'Garantia? | 7 dias de troca.');
assert.deepEqual(textToTrustItems('Compra segura | Mercado Pago.'), [
  { title: 'Compra segura', body: 'Mercado Pago.' },
]);

console.log('product-story web unit tests ok');
