import assert from 'assert';
import {
  extractSearchTerms,
  faqReply,
  isConversationId,
  looksLikeProductQuery,
  needsHandoff,
  noLlmFallbackReply,
  parseLlmJson,
} from './chat.intent';
import { formatCatalogForPrompt } from './chat.prompt';
import { HANDOFF_MESSAGE, PIX_DISCOUNT_PCT, FREE_SHIPPING_REGION } from './chat.facts';

assert.equal(needsHandoff('quero falar com um atendente'), true);
assert.equal(needsHandoff('reclamação do pedido'), true);
assert.equal(needsHandoff('disputa de pagamento'), true);
assert.equal(needsHandoff('cobraram errado no cartão'), true);
assert.equal(needsHandoff('preciso de um humano'), true);
assert.equal(needsHandoff('tem frete gratis?'), false);
assert.equal(needsHandoff('quanto fica no pix?'), false);

const faqPix = faqReply('tem desconto no pix?');
assert.ok(faqPix && faqPix.includes('5%'));
const faqShip = faqReply('como funciona o frete?');
assert.ok(faqShip && /porto alegre/i.test(faqShip));
const faqCash = faqReply('o que é schimitz+?');
assert.ok(faqCash && /1%|cashback/i.test(faqCash));
assert.equal(faqReply('asdf qwerty zxcv'), null);

assert.ok(looksLikeProductQuery('voces tem iphone 15?'));
assert.ok(looksLikeProductQuery('notebook gamer'));
assert.equal(looksLikeProductQuery('tem frete gratis?'), false);

const terms = extractSearchTerms('Procuro um notebook gamer barato');
assert.ok(terms.includes('notebook'));
assert.ok(terms.includes('gamer'));
assert.ok(!terms.includes('procuro'));

assert.equal(isConversationId('not-a-uuid'), false);
assert.equal(isConversationId('3b12f1df-5232-4804-897e-917bf397618a'), true);

const parsed = parseLlmJson('{"reply":"Olá!","handoff":true}');
assert.deepEqual(parsed, { reply: 'Olá!', handoff: true });
assert.ok(parseLlmJson('```json\n{"reply":"ok","handoff":false}\n```')?.reply === 'ok');
assert.equal(parseLlmJson('{"handoff":true}'), null);
assert.equal(parseLlmJson('texto solto sem json')?.reply, 'texto solto sem json');

const fallbackNoKey = noLlmFallbackReply({ faq: null, hasProducts: false });
assert.ok(/WhatsApp/i.test(fallbackNoKey));
assert.ok(/Porto Alegre|PIX|12x|SCHIMITZ/i.test(fallbackNoKey));

const catalog = formatCatalogForPrompt([]);
assert.ok(catalog.includes('nenhum produto'));
const listed = formatCatalogForPrompt([
  {
    name: 'TV 50 Schimitz',
    slug: 'tv-50-schimitz',
    price: 1899,
    compareAtPrice: 2199,
    badge: 'Oferta',
    inStock: true,
    path: '/produto/tv-50-schimitz',
  },
]);
assert.ok(listed.includes('TV 50 Schimitz'));
assert.ok(listed.includes('tv-50-schimitz'));
assert.ok(!listed.includes('iPhone 99 Pro Max Inventado'));

assert.equal(PIX_DISCOUNT_PCT, 5);
assert.equal(FREE_SHIPPING_REGION, 'Porto Alegre');
assert.ok(HANDOFF_MESSAGE.includes('WhatsApp'));

console.log('chat intent/prompt tests ok');
