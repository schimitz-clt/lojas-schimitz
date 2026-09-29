import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cartJourneyLede, checkoutJourneyLede } from './storefront-states';

assert.equal(cartJourneyLede().includes('checkout'), true);
assert.equal(checkoutJourneyLede().includes('PIX'), true);
assert.equal(cartJourneyLede().includes('loja física'), false);

const layout = readFileSync(join(__dirname, '../app/layout.tsx'), 'utf8');
assert.ok(layout.includes('schimitz-system.css'), 'root layout loads the system layer');

const css = readFileSync(join(__dirname, '../components/storefront/schimitz-system.css'), 'utf8');
assert.ok(css.includes('--control-h: 44px'), 'touch target token exists');
assert.ok(css.includes(':focus-visible'), 'focus ring is defined');
assert.ok(css.includes('prefers-reduced-motion'), 'system respects reduced motion');

console.log('storefront-states tests ok');
