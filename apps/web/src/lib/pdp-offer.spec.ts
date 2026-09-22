import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  pdpDescriptionNeedsCollapse,
  pdpMobileContentOrder,
  pdpOfferPills,
  productDescriptionText,
} from './pdp-offer';
import { isMissingPdp, pdpBreadcrumbName } from './pdp-missing';
import { interestFreeInstallmentClaim } from './pricing';

assert.equal(productDescriptionText(null), '');
assert.equal(productDescriptionText(undefined), '');
assert.equal(productDescriptionText('   '), '');
assert.equal(productDescriptionText(123), '');
assert.equal(productDescriptionText('Samsung Galaxy A54 5G\n\nTela 6,4"'), 'Samsung Galaxy A54 5G\n\nTela 6,4"');

assert.equal(isMissingPdp(null, null), true);
assert.equal(isMissingPdp({ name: 'TV' }, null), true);
assert.equal(isMissingPdp(null, { slug: 'tv' }), true);
assert.equal(isMissingPdp({ name: 'TV' }, { slug: '  ' }), true);
assert.equal(isMissingPdp({ name: 'TV' }, { slug: 1 }), true);
assert.equal(isMissingPdp({ name: 'TV' }, { slug: 'tv-50' }), false);
assert.equal(pdpBreadcrumbName(''), 'Produto');
assert.equal(pdpBreadcrumbName('   '), 'Produto');
assert.equal(pdpBreadcrumbName(null), 'Produto');
assert.equal(pdpBreadcrumbName('Ar-condicionado aiwa'), 'Ar-condicionado aiwa');

const pills = pdpOfferPills();
assert.equal(pills.length, 2);
assert.equal(pills[0].id, 'pix');
assert.ok(/pix\s*5%/i.test(pills[0].label));
assert.equal(pills[1].label, interestFreeInstallmentClaim());
assert.ok(/3x sem juros/i.test(pills[1].label));
assert.ok(!/12x/.test(pills.map((p) => p.label).join(' ')));

assert.deepEqual(pdpMobileContentOrder(), [
  'gallery',
  'title',
  'rating',
  'model',
  'seller',
  'price',
  'description',
  'stock',
  'ctas',
]);
assert.equal(pdpDescriptionNeedsCollapse('curto'), false);
assert.equal(pdpDescriptionNeedsCollapse('x'.repeat(361)), true);

const srcRoot = join(__dirname, '..');
const pdp = readFileSync(join(srcRoot, 'app/produto/[slug]/ProductClient.tsx'), 'utf8');
assert.ok(pdp.includes('Vendido por'), 'PDP shows Vendido por');
assert.ok(pdp.includes('initial'), 'PDP accepts SSR initial product so Vendido por is in first HTML');
assert.ok(pdp.includes('productDescriptionText'), 'PDP uses trimmed Admin description');

const pdpPage = readFileSync(join(srcRoot, 'app/produto/[slug]/page.tsx'), 'utf8');
assert.ok(pdpPage.includes('fetchPublicProduct'), 'PDP server page loads public product for SSR');
assert.ok(pdpPage.includes('isMissingPdp'), 'missing PDP uses the miss helper');
assert.ok(pdpPage.includes('notFound()'), 'unknown slug calls notFound');
assert.ok(pdpPage.includes('pdpBreadcrumbName'), 'breadcrumb name comes from the catalog');
assert.equal(pdpPage.includes('product?.name || slug'), false, 'raw slug is not the product name');
const pdpBody = pdpPage.slice(pdpPage.indexOf('export default'));
assert.ok(pdpBody.includes('notFound()'), 'page component 404s a missing product');
assert.ok(
  pdpBody.indexOf('notFound()') < pdpBody.indexOf('buildProductJsonLd('),
  '404 happens before Product JSON-LD',
);
assert.ok(pdpPage.includes('initial='), 'PDP server page passes initial product to client');
assert.ok(pdp.includes('pdpOfferPills'), 'PDP shows Pix 5% / 3x chips');
assert.ok(pdp.includes('className="pdp-title"'), 'PDP keeps h1.pdp-title');
assert.ok(pdp.includes('pdp-desc'), 'PDP keeps description block');
assert.ok(pdp.includes('pdp-desc-toggle'), 'long description can fold with Ver mais');
assert.ok(pdp.includes('Ver mais'), 'collapse control is in Portuguese');
assert.ok(pdp.includes('className="pdp-price-block"'), 'PDP keeps price offer block');
assert.ok(pdp.includes('pdp-price-trust'), 'trust lines sit under the price stack');
assert.ok(pdp.includes('PdpFreightCep'), 'PDP surfaces CEP quote from existing engine');
assert.ok(pdp.includes('PdpRelatedProducts'), 'PDP related rail is wired');
assert.ok(pdp.includes('ProductShareButton'), 'PDP has Compartilhar');
assert.ok(pdp.includes('pdp-title-row'), 'title + rating sit in Magalu-style header row');
assert.ok(pdp.includes('pdp-rating-score'), 'rating score sits beside the product name');
assert.ok(pdp.includes('pdp-gallery-col'), 'gallery column wraps full-bleed photo + tools');
assert.ok(pdp.includes('pdp-gallery-tools'), 'favoritar/compartilhar overlay the photo on mobile');
assert.ok(pdp.includes('pdp-cta-primary'), 'primary ATC spans the mobile CTA grid');
assert.ok(pdp.includes('pdp-cta-buy-now'), 'Comprar agora sits under Adicionar à sacola');
assert.ok(pdp.includes('buyNowLabel'), 'Comprar agora label comes from the helper');
assert.ok(pdp.includes('pdpBuyNowHref'), 'Comprar agora navigates with the sacola helper');
assert.ok(pdp.includes("router.push(pdpBuyNowHref())"), 'Comprar agora leaves for the sacola after add');
assert.ok(pdp.includes('pdp-cta-wa'), 'WhatsApp stays in the CTA row');
assert.equal(pdp.includes('Retire na loja'), false, 'no store-pickup CTA');
assert.ok(pdp.includes('pixPrice('), 'PDP reuses pixPrice');
assert.ok(pdp.includes('installmentLine('), 'PDP reuses installmentLine');
assert.ok(!/style=\{\{\s*padding:\s*'24px 0'\s*\}\}/.test(pdp), 'PDP must not inline-override padding (hides sticky clearance)');

const titleAt = pdp.indexOf('className="pdp-title"');
const ratingAt = pdp.indexOf('className="pdp-rating"');
const modelAt = pdp.indexOf('className="pdp-model');
const sellerAt = pdp.indexOf('className="pdp-seller');
const priceAt = pdp.indexOf('className="pdp-price-block"');
const descAt = pdp.indexOf('className={`pdp-desc');
const stockAt = pdp.indexOf('className={`pdp-stock');
const actionsAt = pdp.indexOf('className="actions pdp-actions"');
assert.ok(titleAt > 0 && ratingAt > titleAt && ratingAt < priceAt, 'rating sits with title, before price');
assert.ok(modelAt > ratingAt && modelAt < priceAt, 'model under title/rating');
assert.ok(sellerAt > modelAt && sellerAt < priceAt, 'seller before price');
assert.ok(priceAt < descAt, 'price block before description');
assert.ok(descAt < stockAt, 'description before stock');
assert.ok(stockAt < actionsAt, 'stock before ATC actions');
assert.ok(descAt < actionsAt, 'description before ATC actions (prominent, not buried)');

const css = readFileSync(join(srcRoot, 'app/globals.css'), 'utf8');
assert.ok(css.includes('.pdp-offer-pills'), 'mobile offer chips styled');
assert.ok(/\.pdp-carousel-slide\s*\{[^}]*min-width:\s*100%/.test(css), 'gallery slides lock to track width');
assert.ok(/\.pdp-carousel-slide\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/.test(css), 'gallery uses a full-width square frame');
assert.equal(/height:\s*min\(28vh,\s*200px\)/.test(css), false, 'gallery must not use the 200px strip cap');
assert.equal(
  /padding-bottom:\s*calc\(248px/.test(css),
  false,
  'mobile PDP does not reserve space for a fixed purchase bar',
);
assert.ok(
  /@media \(max-width: 720px\)[\s\S]*\.main-shell\s*\{[^}]*padding-bottom:\s*calc\(96px\s*\+\s*env\(safe-area-inset-bottom/.test(css),
  'bottom nav clearance stays on .main-shell',
);
assert.ok(
  /@media \(max-width: 720px\)[\s\S]*\.bottom-nav\s*\{[^}]*position:\s*fixed/.test(css),
  'only the bottom nav stays fixed on mobile',
);
assert.ok(
  /@media \(min-width: 721px\)[\s\S]*\.pdp-desc\s*\{\s*order:\s*7/.test(css),
  'desktop keeps description after ATC (not between price and buy)',
);
assert.ok(
  /@media \(max-width: 720px\)[\s\S]*\.pdp-title-row\s*\{[^}]*display:\s*flex/.test(css),
  'mobile title + rating stay on one row',
);
assert.ok(
  /@media \(max-width: 720px\)[\s\S]*\.pdp-model\s*\{[^}]*text-align:\s*center/.test(css),
  'mobile model line is centered',
);
assert.ok(
  /@media \(max-width: 720px\)[\s\S]*\.pdp-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(0,\s*1fr\)/.test(css),
  'mobile CTAs use a 2-col grid that cannot overflow',
);
assert.ok(css.includes('.pdp-cta-buy-now'), 'outlined Comprar agora is styled in the Schimitz palette');
const mobilePdpCss = css.slice(
  css.indexOf('@media (max-width: 720px)'),
  css.indexOf('@media (max-width: 520px)'),
);
assert.equal(
  /\.pdp-actions \.pdp-cta-primary,\s*\.pdp-actions \.pdp-cta-buy-now\s*\{\s*display:\s*none/.test(mobilePdpCss),
  false,
  'mobile keeps inline Adicionar à sacola and Comprar agora in the scroll',
);
assert.equal(
  mobilePdpCss.includes('.pdp-sticky-atc'),
  false,
  'mobile CSS does not pin a PDP purchase bar',
);
assert.equal(
  /\.pdp-actions \.pdp-cta-wa\s*\{[^}]*display:\s*none/.test(mobilePdpCss),
  false,
  'WhatsApp stays in the mobile page body',
);
const desktopPdpCss = css.slice(css.lastIndexOf('@media (min-width: 721px)'));
assert.equal(
  /\.pdp-actions \.pdp-cta-primary[\s\S]{0,160}display:\s*none/.test(desktopPdpCss),
  false,
  'desktop buy box keeps Adicionar and Comprar agora',
);
assert.ok(css.includes('.pdp-desc.is-collapsed'), 'long specs clamp on mobile');
assert.ok(css.includes('.pdp-desc-toggle'), 'Ver mais control is styled');
assert.equal(
  /\.pdp-actions \.fav-toggle \{\s*display:\s*none/.test(css),
  false,
  'Favoritar stays in the mobile CTA row',
);
assert.ok(
  /@media \(max-width: 720px\)[\s\S]*\.pdp-trust\s*\{[^}]*grid-template-columns:\s*1fr/.test(css),
  'mobile trust benefits stack in one column',
);

const catalog = readFileSync(join(srcRoot, 'components/admin/sections/AdminCatalogoSection.tsx'), 'utf8');
assert.ok(catalog.includes('AdminPhotoFilePicker'), 'catalog uses mobile-safe photo picker');
assert.ok(catalog.includes('Adicionar mais fotos') || catalog.includes('Adicionar fotos'), 'owner can add more photos');
assert.ok(!catalog.includes('admin-file-hidden'), 'catalog must not use clipped 1px file input');

const adminState = readFileSync(join(srcRoot, 'components/admin/admin-console-state.ts'), 'utf8');
assert.ok(adminState.includes('applyProductSaveImageFields'), 'save omits empty imageUrl via helper');
assert.ok(adminState.includes('/admin/products/${'), 'edit loads/saves via product id APIs');
assert.ok(!/if \(editingId\) \{[\s\S]{0,400}body\.imageUrl/.test(adminState), 'edit save must not send imageUrl (would replace cover)');

const dailyOps = readFileSync(join(srcRoot, 'lib/admin-daily-ops.ts'), 'utf8');
assert.ok(dailyOps.includes('body.imageUrls'), 'create persists extra photos in the same request');

console.log('pdp-offer unit tests ok');
