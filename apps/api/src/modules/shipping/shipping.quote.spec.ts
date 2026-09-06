import {
  computeShippingQuote,
  DEFAULT_SHIPPING_SETTINGS,
  formatShippingBrl,
  normalizeCep,
  pickCepRule,
  resolveShippingLabel,
} from './shipping.rules';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(normalizeCep('89.010-000') === '89010000', 'normalize cep');
assert(normalizeCep('abc') === '', 'normalize empty');
assert(formatShippingBrl(29.9) === 'R$ 29,90', 'brl format');
assert(formatShippingBrl(19.9) === 'R$ 19,90', 'brl 19.9');

const rules = [
  { cepPrefix: '89', fee: 25, estimatedDays: 4, label: 'SC Oeste', sortOrder: 0 },
  { cepPrefix: '890', fee: 15, estimatedDays: 2, label: 'Blumenau', sortOrder: 0 },
  { cepPrefix: '89010', fee: 9.9, estimatedDays: 1, label: 'Centro Blumenau', sortOrder: 0 },
];

const pick = pickCepRule('89010000', rules);
assert(pick?.cepPrefix === '89010', 'longest prefix wins');

const q1 = computeShippingQuote({
  cep: '89010-000',
  subtotal: 100,
  settings: DEFAULT_SHIPPING_SETTINGS,
  rules,
});
assert(q1.price === 9.9, `expected 9.9 got ${q1.price}`);
assert(q1.days === 1, 'days from zone');
assert(q1.modality === 'zona', 'modality zona');
assert(q1.matchedPrefix === '89010', 'matched prefix');
assert(q1.label === 'Centro Blumenau', 'keeps rule label');

const qFree = computeShippingQuote({
  cep: '89010-000',
  subtotal: 299,
  settings: DEFAULT_SHIPPING_SETTINGS,
  rules,
});
assert(qFree.price === 0, 'free above');
assert(qFree.modality === 'gratis', 'modality gratis');
assert(qFree.days === 1, 'days kept from zone when free');
assert(qFree.label === 'Centro Blumenau', 'rule label wins even when free');

const qDefault = computeShippingQuote({
  cep: '01310-100',
  subtotal: 100,
  settings: DEFAULT_SHIPPING_SETTINGS,
  rules,
});
assert(qDefault.price === 19.9, `default fee got ${qDefault.price}`);
assert(qDefault.days === 5, 'default days');
assert(qDefault.modality === 'padrao', 'modality padrao');
assert(qDefault.matchedPrefix === null, 'no match');
assert(qDefault.label === 'Entrega própria — R$ 19,90', `default label got ${qDefault.label}`);

const qProdFee = computeShippingQuote({
  cep: '01310100',
  subtotal: 50,
  settings: { freeAbove: 299, defaultFee: 29.9, defaultDays: 5 },
  rules: [{ cepPrefix: '90', fee: 0, estimatedDays: 1, label: 'Porto Alegre — frete grátis', sortOrder: 10 }],
});
assert(qProdFee.price === 29.9, 'prod default fee');
assert(qProdFee.label === 'Entrega própria — R$ 29,90', `prod non-POA label got ${qProdFee.label}`);

const qPoa = computeShippingQuote({
  cep: '90010000',
  subtotal: 50,
  settings: { freeAbove: 299, defaultFee: 29.9, defaultDays: 5 },
  rules: [{ cepPrefix: '90', fee: 0, estimatedDays: 1, label: 'Porto Alegre — frete grátis', sortOrder: 10 }],
});
assert(qPoa.price === 0, 'POA free');
assert(qPoa.label === 'Porto Alegre — frete grátis', `POA label got ${qPoa.label}`);

assert(
  resolveShippingLabel({ ruleLabel: null, price: 29.9, modality: 'padrao', freeAbove: 299 }) ===
    'Entrega própria — R$ 29,90',
  'resolve paid',
);

const tie = pickCepRule('89000', [
  { cepPrefix: '890', fee: 1, estimatedDays: 1, sortOrder: 1 },
  { cepPrefix: '890', fee: 2, estimatedDays: 2, sortOrder: 5 },
]);
assert(tie?.fee === 2, 'higher sortOrder on same length');

console.log('shipping.quote.spec.ts OK');
