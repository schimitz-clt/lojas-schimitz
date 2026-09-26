import assert from 'node:assert/strict';
import { publicProductStory, storyHasContent } from './product-story';

{
  const empty = publicProductStory(null);
  assert.deepEqual(empty, { highlights: [], features: [], boxContents: [], faq: [] });
  assert.equal(storyHasContent(empty), false);
}

{
  const story = publicProductStory({
    highlights: ['  Cancelamento adaptativo  ', '', 12, 'x'.repeat(200)],
    features: [
      { label: ' Bateria ', value: '40 h' },
      { label: '', value: 'nope' },
      { label: 'Peso', value: '' },
    ],
    boxContents: ['Cabo USB-C'],
    faq: [{ question: 'Funciona no iPhone?', answer: 'Sim, por Bluetooth.' }, { question: 'Só pergunta' }],
  });
  assert.equal(story.highlights.length, 2);
  assert.equal(story.highlights[0], 'Cancelamento adaptativo');
  assert.equal(story.highlights[1].length, 120);
  assert.deepEqual(story.features, [{ label: 'Bateria', value: '40 h' }]);
  assert.deepEqual(story.boxContents, ['Cabo USB-C']);
  assert.deepEqual(story.faq, [{ question: 'Funciona no iPhone?', answer: 'Sim, por Bluetooth.' }]);
  assert.equal(storyHasContent(story), true);
}

console.log('product-story unit tests ok');
