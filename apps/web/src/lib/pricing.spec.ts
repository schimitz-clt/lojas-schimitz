import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  pixPrice,
  pixSavings,
  PIX_DISCOUNT,
  PIX_PROMO_COLLIDING_COUPON_CODES,
  isPixPromoCollidingCouponCode,
  toNumber,
  MAX_INSTALLMENTS,
  CARD_INSTALLMENTS_HIGHLIGHT,
  INSTALLMENT_INTEREST_NOTE,
  clampInstallments,
  installmentSuffix,
  installmentValue,
  installmentLine,
  cardInstallmentClaim,
  installmentTableNote,
} from './pricing';

assert.equal(PIX_DISCOUNT, 0.05);
assert.equal(pixPrice(100), 95);
assert.equal(pixSavings(100), 5);
assert.deepEqual([...PIX_PROMO_COLLIDING_COUPON_CODES], ['PIX5']);
assert.equal(isPixPromoCollidingCouponCode('pix5'), true);
assert.equal(isPixPromoCollidingCouponCode('OFF10'), false);
assert.equal(isPixPromoCollidingCouponCode(''), false);
assert.equal(pixPrice(199.9), Math.round(199.9 * 0.95 * 100) / 100);
assert.equal(pixSavings(199.9), Math.round((199.9 - pixPrice(199.9)) * 100) / 100);
assert.ok(pixSavings(199.9) > 0);
assert.equal(pixSavings(0), 0);
assert.equal(pixSavings('50'), 2.5);
assert.equal(toNumber('x'), 0);
assert.equal(pixSavings(null as unknown as number), 0);

// Display helper must never invent a different rate than 5%.
const base = 347.8;
const sum = Math.round((pixPrice(base) + pixSavings(base)) * 100) / 100;
assert.equal(sum, Math.round(base * 100) / 100);

assert.equal(MAX_INSTALLMENTS, 12);
assert.equal(CARD_INSTALLMENTS_HIGHLIGHT, 3);
assert.ok(CARD_INSTALLMENTS_HIGHLIGHT < MAX_INSTALLMENTS);

assert.equal(clampInstallments(0), 1);
assert.equal(clampInstallments(99), MAX_INSTALLMENTS);

assert.equal(installmentSuffix(1), ' à vista');
for (const n of [2, 3, 4, 12]) {
  const sfx = installmentSuffix(n);
  assert.ok(/juros conforme o cartão/.test(sfx), `suffix ${n}x avisa que há juros: ${sfx}`);
  assert.ok(!/sem juros/i.test(sfx));
}

assert.equal(installmentValue(120, 3), 40);
assert.equal(installmentValue(120, 12), 10);

// Acima de 1x a linha NÃO mostra valor de parcela (a real inclui juros do cartão) nem "sem juros".
const line = installmentLine(120);
assert.equal(line, 'Parcele em até 3x no cartão');
assert.equal(installmentLine(120, 12), 'Parcele em até 12x no cartão');

const oneShot = installmentLine(120, 1);
assert.ok(oneShot.startsWith('1x de '));
assert.ok(oneShot.includes('à vista'));

assert.equal(cardInstallmentClaim(), 'Parcele em até 3x no cartão');
const note = installmentTableNote();
assert.ok(note.includes('até 3x no cartão'));
assert.ok(note.includes('12x'));
assert.ok(/Mercado Pago/.test(note));
assert.ok(note.includes(INSTALLMENT_INTEREST_NOTE));
assert.ok(/juros/.test(INSTALLMENT_INTEREST_NOTE) && !/sem juros/i.test(INSTALLMENT_INTEREST_NOTE));
for (const t of [line, oneShot, note, cardInstallmentClaim()]) {
  assert.ok(!/sem juros|s\/ juros|sem acr[eé]scimo/i.test(t), `não pode prometer sem juros: ${t}`);
}

const srcRoot = join(__dirname, '..');
const marketingFiles = [
  'components/Header.tsx',
  'components/HomeBanners.tsx',
  'components/TrustBadges.tsx',
  'components/StorefrontChrome.tsx',
  'components/ProductCard.tsx',
  'app/marketplace/page.tsx',
  'app/produto/[slug]/ProductClient.tsx',
  'app/home-client.tsx',
];
for (const f of marketingFiles) {
  const src = readFileSync(join(srcRoot, f), 'utf8');
  assert.ok(!/sem juros|s\/ juros/i.test(src), `${f} não pode prometer sem juros`);
}

const pdp = readFileSync(join(srcRoot, 'app/produto/[slug]/ProductClient.tsx'), 'utf8');
assert.ok(pdp.includes('installmentSuffix'), 'PDP table uses honest suffix');
assert.ok(pdp.includes('installmentTableNote'), 'PDP table explains 4–12x may include interest');
assert.ok(pdp.includes('MAX_INSTALLMENTS'), 'PDP still lists 1–12 options');
assert.ok(pdp.includes('installmentLine'), 'PDP headline uses installmentLine (3x default)');

const brickUi = readFileSync(join(srcRoot, 'lib/card-payment-ui.ts'), 'utf8');
assert.ok(brickUi.includes('maxInstallments: MAX_INSTALLMENTS'), 'Brick still max 12');

const checkout = readFileSync(join(srcRoot, 'app/checkout/page.tsx'), 'utf8');
assert.ok(checkout.includes('isPixPromoCollidingCouponCode'), 'checkout skips stacked PIX preview');
assert.ok(!/placeholder="Ex\.: PIX5"/.test(checkout), 'checkout must not advertise retired PIX5');

console.log('pricing display helpers ok');
