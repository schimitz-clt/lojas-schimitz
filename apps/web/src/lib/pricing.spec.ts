import assert from 'assert';
import { pixPrice, pixSavings, PIX_DISCOUNT, toNumber } from './pricing';

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

console.log('pricing display helpers ok');
