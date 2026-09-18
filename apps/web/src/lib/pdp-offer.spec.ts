import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  pdpMobileContentOrder,
  pdpOfferPills,
  productDescriptionText,
} from './pdp-offer';
import { interestFreeInstallmentClaim } from './pricing';

assert.equal(productDescriptionText(null), '');
assert.equal(productDescriptionText(undefined), '');
assert.equal(productDescriptionText('   '), '');
assert.equal(productDescriptionText(123), '');
assert.equal(productDescriptionText('Samsung Galaxy A54 5G\n\nTela 6,4"'), 'Samsung Galaxy A54 5G\n\nTela 6,4"');

const pills = pdpOfferPills();
assert.equal(pills.length, 2);
assert.equal(pills[0].id, 'pix');
assert.ok(/pix\s*5%/i.test(pills[0].label));
assert.equal(pills[1].label, interestFreeInstallmentClaim());
assert.ok(/3x sem juros/i.test(pills[1].label));
assert.ok(!/12x/.test(pills.map((p) => p.label).join(' ')));

assert.deepEqual(pdpMobileContentOrder(), ['gallery', 'title', 'offers', 'price', 'description']);

const srcRoot = join(__dirname, '..');
const pdp = readFileSync(join(srcRoot, 'app/produto/[slug]/ProductClient.tsx'), 'utf8');
assert.ok(pdp.includes('productDescriptionText'), 'PDP uses trimmed Admin description');
assert.ok(pdp.includes('pdpOfferPills'), 'PDP shows Pix 5% / 3x chips');
assert.ok(pdp.includes('className="pdp-title"'), 'PDP keeps h1.pdp-title');
assert.ok(pdp.includes('className="pdp-desc"'), 'PDP keeps description block');
assert.ok(pdp.includes('className="pdp-price-block"'), 'PDP keeps price offer block');
assert.ok(pdp.includes('pixPrice('), 'PDP reuses pixPrice');
assert.ok(pdp.includes('installmentLine('), 'PDP reuses installmentLine');
assert.ok(!/style=\{\{\s*padding:\s*'24px 0'\s*\}\}/.test(pdp), 'PDP must not inline-override padding (hides sticky clearance)');

const titleAt = pdp.indexOf('className="pdp-title"');
const priceAt = pdp.indexOf('className="pdp-price-block"');
const descAt = pdp.indexOf('className="pdp-desc"');
const actionsAt = pdp.indexOf('className="actions pdp-actions"');
assert.ok(titleAt > 0 && titleAt < priceAt, 'title before price block');
assert.ok(priceAt < descAt, 'price block before description');
assert.ok(descAt < actionsAt, 'description before ATC actions (prominent, not buried)');

const css = readFileSync(join(srcRoot, 'app/globals.css'), 'utf8');
assert.ok(css.includes('.pdp-offer-pills'), 'mobile offer chips styled');
assert.ok(/\.pdp-carousel-slide[\s\S]*max-height/.test(css), 'gallery height capped');
assert.ok(
  /@media \(max-width: 720px\)[\s\S]*\.pdp[\s\S]*padding-bottom:\s*calc\(/.test(css),
  'mobile PDP padding clears sticky ATC + bottom nav',
);
assert.ok(
  /@media \(min-width: 721px\)[\s\S]*\.pdp-desc\s*\{\s*order:\s*7/.test(css),
  'desktop keeps description after ATC (not between price and buy)',
);

const catalog = readFileSync(join(srcRoot, 'components/admin/sections/AdminCatalogoSection.tsx'), 'utf8');
assert.ok(/\bmultiple\b/.test(catalog), 'catalog file input stays multiple');
assert.ok(catalog.includes('Adicionar mais fotos') || catalog.includes('Adicionar fotos'), 'owner can add more photos');

const adminState = readFileSync(join(srcRoot, 'components/admin/admin-console-state.ts'), 'utf8');
assert.ok(adminState.includes('imageUrls'), 'create persists extra photos in the same request');
assert.ok(adminState.includes('/admin/products/${'), 'edit loads/saves via product id APIs');
assert.ok(adminState.includes('applyProductSaveImageFields'), 'save omits empty imageUrl via helper');
assert.ok(!/if \(editingId\) \{[\s\S]{0,400}body\.imageUrl/.test(adminState), 'edit save must not send imageUrl (would replace cover)');

console.log('pdp-offer unit tests ok');
