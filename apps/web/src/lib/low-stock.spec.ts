import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOW_STOCK_LABEL, LOW_STOCK_MAX, shouldShowLowStock } from './low-stock';
import { stockBadge } from './pricing';
import { pdpLowStockUrgency, pdpStockLine } from './pdp-trust';
import { stockCompareLabel } from './product-media';

assert.equal(LOW_STOCK_MAX, 3);
assert.equal(LOW_STOCK_LABEL, 'Últimas unidades');

assert.equal(shouldShowLowStock(null), false);
assert.equal(shouldShowLowStock(undefined), false);
assert.equal(shouldShowLowStock(Number.NaN), false);
assert.equal(shouldShowLowStock(Number.POSITIVE_INFINITY), false);
assert.equal(shouldShowLowStock(-1), false);
assert.equal(shouldShowLowStock(0), false);
assert.equal(shouldShowLowStock(0.9), false);
assert.equal(shouldShowLowStock(1), true);
assert.equal(shouldShowLowStock(2), true);
assert.equal(shouldShowLowStock(3), true);
assert.equal(shouldShowLowStock(3.9), true);
assert.equal(shouldShowLowStock(4), false);
assert.equal(shouldShowLowStock(5), false);
assert.equal(shouldShowLowStock(12), false);

assert.equal(stockBadge(null), null);
assert.equal(stockBadge(undefined), null);
assert.deepEqual(stockBadge(0), { label: 'Esgotado', tone: 'out' });
assert.deepEqual(stockBadge(1), { label: LOW_STOCK_LABEL, tone: 'low' });
assert.deepEqual(stockBadge(3), { label: LOW_STOCK_LABEL, tone: 'low' });
assert.equal(stockBadge(4), null);
assert.equal(stockBadge(5), null);
assert.equal(stockBadge(20), null);

assert.equal(pdpLowStockUrgency(4), null);
assert.equal(pdpLowStockUrgency(3), LOW_STOCK_LABEL);
assert.equal(pdpStockLine(4), 'Em estoque · 4 unidades');
assert.equal(pdpStockLine(3), 'Últimas unidades · 3 restantes');

assert.equal(stockCompareLabel(4), 'Em estoque (4)');
assert.equal(stockCompareLabel(5), 'Em estoque (5)');
assert.equal(stockCompareLabel(2), 'Últimas unidades (2)');

const srcRoot = join(__dirname, '..');
const card = readFileSync(join(srcRoot, 'components/ProductCard.tsx'), 'utf8');
assert.ok(card.includes('stockBadge'), 'cards reuse stockBadge');
assert.ok(card.includes('resolveProductStock'), 'cards use real inventory fields');
assert.ok(!/pessoas vendo|visualizando agora|visitantes/i.test(card), 'cards never invent viewers');

const pdp = readFileSync(join(srcRoot, 'app/produto/[slug]/ProductClient.tsx'), 'utf8');
assert.ok(pdp.includes('pdpLowStockUrgency'), 'PDP urgency stays wired');
assert.ok(!/pessoas vendo|visualizando agora/i.test(pdp), 'PDP never invents viewers');

const pricing = readFileSync(join(srcRoot, 'lib/pricing.ts'), 'utf8');
assert.ok(pricing.includes('shouldShowLowStock'), 'stockBadge uses shared ≤3 helper');
assert.ok(!/stock\s*<=\s*5/.test(pricing), 'stockBadge must not treat 4–5 as low stock');

console.log('low-stock unit tests ok');
