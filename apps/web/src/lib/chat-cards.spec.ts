import assert from 'assert';
import { pixPrice } from './pricing';

/** Display PIX on chat cards must use the official 5% helper — never invent a rate. */
const price = 199.9;
const pix = pixPrice(price);
assert.equal(pix, Math.round(199.9 * 0.95 * 100) / 100);
assert.ok(pix < price);
assert.equal(pixPrice(100), 95);

console.log('chat-cards pricing tests ok');
