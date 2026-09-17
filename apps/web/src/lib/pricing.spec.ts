import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  pixPrice,
  pixSavings,
  PIX_DISCOUNT,
  toNumber,
  MAX_INSTALLMENTS,
  INTEREST_FREE_INSTALLMENTS,
  clampInstallments,
  isInterestFreeInstallment,
  installmentSuffix,
  installmentValue,
  installmentLine,
  interestFreeInstallmentClaim,
  installmentTableNote,
} from './pricing';

assert.equal(PIX_DISCOUNT, 0.05);
assert.equal(pixPrice(100), 95);
assert.equal(pixSavings(100), 5);
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
assert.equal(INTEREST_FREE_INSTALLMENTS, 3);
assert.ok(INTEREST_FREE_INSTALLMENTS < MAX_INSTALLMENTS);

assert.equal(clampInstallments(0), 1);
assert.equal(clampInstallments(99), MAX_INSTALLMENTS);
assert.equal(isInterestFreeInstallment(1), true);
assert.equal(isInterestFreeInstallment(INTEREST_FREE_INSTALLMENTS), true);
assert.equal(isInterestFreeInstallment(INTEREST_FREE_INSTALLMENTS + 1), false);
assert.equal(isInterestFreeInstallment(MAX_INSTALLMENTS), false);

assert.equal(installmentSuffix(1), ' à vista');
assert.equal(installmentSuffix(2), ' sem juros');
assert.equal(installmentSuffix(3), ' sem juros');
assert.equal(installmentSuffix(4), ' (podem incluir juros)');
assert.equal(installmentSuffix(12), ' (podem incluir juros)');

assert.equal(installmentValue(120, 3), 40);
assert.equal(installmentValue(120, 12), 10);

const line = installmentLine(120);
assert.ok(line.startsWith('3x de '), `default installmentLine must advertise 3x, got: ${line}`);
assert.ok(line.includes('sem juros'), `default line must claim sem juros: ${line}`);
assert.ok(!line.startsWith('12x'), `must not advertise 12x sem juros: ${line}`);
assert.ok(!/podem incluir juros/.test(line));

const withInterest = installmentLine(120, 12);
assert.ok(withInterest.startsWith('12x de '), `12x line amount: ${withInterest}`);
assert.ok(/podem incluir juros/.test(withInterest), `12x must not claim sem juros: ${withInterest}`);
assert.ok(!/sem juros/.test(withInterest));

const oneShot = installmentLine(120, 1);
assert.ok(oneShot.startsWith('1x de '));
assert.ok(oneShot.includes('à vista'));
assert.ok(!/sem juros/.test(oneShot));

assert.equal(interestFreeInstallmentClaim(), 'Até 3x sem juros');
assert.ok(installmentTableNote().includes('3x sem juros'));
assert.ok(installmentTableNote().includes('4 a 12x'));
assert.ok(/Mercado Pago/.test(installmentTableNote()));

const srcRoot = join(__dirname, '..');
const marketingFiles = [
  'components/Header.tsx',
  'components/HomeBanners.tsx',
  'components/TrustBadges.tsx',
  'components/StorefrontChrome.tsx',
  'components/ProductCard.tsx',
  'app/marketplace/page.tsx',
  'app/produto/[slug]/ProductClient.tsx',
  'app/page.tsx',
];
for (const f of marketingFiles) {
  const src = readFileSync(join(srcRoot, f), 'utf8');
  assert.ok(!/12x\s*sem juros/i.test(src), `${f} must not claim 12x sem juros`);
}

const pdp = readFileSync(join(srcRoot, 'app/produto/[slug]/ProductClient.tsx'), 'utf8');
assert.ok(pdp.includes('installmentSuffix'), 'PDP table uses honest suffix');
assert.ok(pdp.includes('installmentTableNote'), 'PDP table explains 4–12x may include interest');
assert.ok(pdp.includes('MAX_INSTALLMENTS'), 'PDP still lists 1–12 options');
assert.ok(pdp.includes('installmentLine'), 'PDP headline uses installmentLine (3x default)');

const brickUi = readFileSync(join(srcRoot, 'lib/card-payment-ui.ts'), 'utf8');
assert.ok(brickUi.includes('maxInstallments: MAX_INSTALLMENTS'), 'Brick still max 12');

console.log('pricing display helpers ok');
