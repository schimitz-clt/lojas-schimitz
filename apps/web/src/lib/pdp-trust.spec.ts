import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RELATED_PRODUCTS_MAX,
  STOREFRONT_CEP_KEY,
  cepDigits,
  formatCepInput,
  isCompleteCep,
  parseCatalogProductItems,
  persistStoredCep,
  pdpBenefitTrustItems,
  pdpFreightCheckoutFallback,
  pdpFreightIdleCopy,
  pdpFreightResultCopy,
  pdpLowStockUrgency,
  pdpPriceTrustLines,
  pdpStockLine,
  pickRelatedProducts,
  readStoredCep,
  relatedProductsCopy,
  relatedProductsHref,
  shouldShowRelatedProducts,
} from './pdp-trust';

{
  const lines = pdpPriceTrustLines();
  assert.equal(lines.length, 2);
  assert.ok(lines.every((l) => l.title && l.body && l.href));
  assert.ok(lines.some((l) => l.href === '/termos' && /troca/i.test(l.title)));
  assert.ok(lines.some((l) => l.href === '/suporte' && /devolu/i.test(l.title)));
  assert.ok(!lines.some((l) => /pessoas vendo|visualiza/i.test(`${l.title} ${l.body}`)));
  const benefits = pdpBenefitTrustItems();
  assert.ok(benefits.some((b) => b.href === '/termos'));
  assert.ok(benefits.some((b) => b.href === '/suporte'));
  assert.ok(benefits.some((b) => /POA|Porto Alegre/i.test(`${b.title} ${b.body}`)));
  console.log('pdp-trust: copy — PASSOU');
}

{
  const current = { id: 'tv', slug: 'tv-a', categorySlug: 'eletro' };
  const pool = [
    { id: 'tv', slug: 'tv-a', category: { slug: 'eletro' } },
    { id: 'sound', slug: 'sound', category: { slug: 'eletro' } },
    { id: 'phone', slug: 'phone', category: { slug: 'celulares' } },
    { id: 'fridge', slug: 'fridge', category: { slug: 'eletro' } },
  ];
  const picked = pickRelatedProducts(current, pool);
  assert.equal(picked.kind, 'category');
  assert.deepEqual(
    picked.items.map((p) => p.id),
    ['sound', 'fridge', 'phone'],
  );
  assert.equal(shouldShowRelatedProducts(picked.items.length), true);
  assert.equal(shouldShowRelatedProducts(0), false);
  assert.equal(relatedProductsCopy('category').title, 'Você também pode gostar');
  assert.ok(/categoria/i.test(relatedProductsCopy('category').subtitle));
  assert.ok(!/comprou/i.test(relatedProductsCopy('catalog').title));
  assert.equal(relatedProductsHref('eletro'), '/departamento/eletro');
  assert.equal(relatedProductsHref(''), '/produtos');

  const onlyOther = pickRelatedProducts({ id: 'x', slug: 'x' }, [
    { id: 'y', slug: 'y', category: { slug: 'casa' } },
  ]);
  assert.equal(onlyOther.kind, 'catalog');
  assert.equal(onlyOther.items[0].id, 'y');

  const empty = pickRelatedProducts({ id: 'solo', slug: 'solo' }, [
    { id: 'solo', slug: 'solo', category: { slug: 'eletro' } },
  ]);
  assert.equal(empty.items.length, 0);
  assert.equal(shouldShowRelatedProducts(empty.items.length), false);

  const many = Array.from({ length: 12 }, (_, i) => ({
    id: `p${i}`,
    slug: `p${i}`,
    category: { slug: 'eletro' },
  }));
  assert.equal(pickRelatedProducts({ id: 'p0', slug: 'p0', categorySlug: 'eletro' }, many).items.length, RELATED_PRODUCTS_MAX);

  assert.deepEqual(
    parseCatalogProductItems({ items: [{ id: 'a' }, { name: 'no-id' }] }).map((x) => x.id),
    ['a'],
  );
  console.log('pdp-trust: related — PASSOU');
}

{
  assert.equal(formatCepInput('91160390'), '91160-390');
  assert.equal(formatCepInput('91.160-390'), '91160-390');
  assert.equal(formatCepInput('911'), '911');
  assert.equal(cepDigits('91160-390'), '91160390');
  assert.equal(isCompleteCep('91160-390'), true);
  assert.equal(isCompleteCep('91160'), false);
  assert.equal(STOREFRONT_CEP_KEY, 'sch_cep');

  const mem: Record<string, string> = {};
  const storage = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => {
      mem[k] = v;
    },
  };
  assert.equal(readStoredCep(storage), '');
  persistStoredCep('90010-000', storage);
  assert.equal(readStoredCep(storage), '90010-000');
  persistStoredCep('123', storage);
  assert.equal(readStoredCep(storage), '90010-000');

  const idle = pdpFreightIdleCopy();
  assert.ok(/CEP/i.test(idle.body));
  const fallback = pdpFreightCheckoutFallback();
  assert.ok(/checkout/i.test(fallback.title));
  assert.ok(!/\d+,\d{2}/.test(fallback.body), 'fallback must not invent a price');

  const free = pdpFreightResultCopy({
    price: 0,
    days: 1,
    label: 'Porto Alegre (90) — frete grátis',
    matchedPrefix: '90',
  });
  assert.equal(free.title, 'Frete grátis');
  assert.ok(/1 dia após o despacho/.test(free.detail));
  assert.ok(/90/.test(free.detail));

  const paid = pdpFreightResultCopy({ price: 19.9, days: 5, label: 'Entrega própria — R$ 19,90' });
  assert.equal(paid.title, 'Frete: R$ 19,90');
  assert.ok(/5 dias/.test(paid.detail));
  console.log('pdp-trust: freight — PASSOU');
}

{
  assert.equal(pdpLowStockUrgency(null), null);
  assert.equal(pdpLowStockUrgency(undefined), null);
  assert.equal(pdpLowStockUrgency(0), null);
  assert.equal(pdpLowStockUrgency(4), null);
  assert.equal(pdpLowStockUrgency(5), null);
  assert.equal(pdpLowStockUrgency(3), 'Últimas unidades');
  assert.equal(pdpLowStockUrgency(1), 'Últimas unidades');
  assert.equal(pdpStockLine(null), 'Estoque sob consulta');
  assert.equal(pdpStockLine(0), 'Esgotado');
  assert.equal(pdpStockLine(2), 'Últimas unidades · 2 restantes');
  assert.equal(pdpStockLine(8), 'Em estoque · 8 unidades');
  console.log('pdp-trust: stock urgency — PASSOU');
}

{
  const srcRoot = join(__dirname, '..');
  const pdp = readFileSync(join(srcRoot, 'app/produto/[slug]/ProductClient.tsx'), 'utf8');
  assert.ok(pdp.includes('pdpPriceTrustLines'), 'PDP shows trust lines under price');
  assert.ok(pdp.includes('PdpFreightCep'), 'PDP wires existing CEP quote UI');
  assert.ok(pdp.includes('PdpRelatedProducts'), 'PDP shows related catalog products');
  assert.ok(pdp.includes('pdpLowStockUrgency'), 'PDP urgency uses real stock ≤3');
  assert.ok(pdp.includes('ProductGallery'), 'gallery stays');
  assert.ok(pdp.includes('pdp-sticky-atc'), 'sticky bag bar stays');
  assert.ok(pdp.includes('ProductShareButton'), 'share stays');
  assert.ok(pdp.includes('pixPrice('), 'PIX stack stays');
  assert.ok(
    pdp.includes('Keep the SSR product') || pdp.includes('if (!existing) setErr'),
    'client refresh failure must not replace a loaded PDP with a fetch alert',
  );
  assert.ok(!/pessoas vendo|visualizando agora/i.test(pdp), 'no fake viewer counts');
  assert.ok(!/Melhor Envio|Correios API/i.test(pdp), 'no invented carrier');

  const page = readFileSync(join(srcRoot, 'app/produto/[slug]/page.tsx'), 'utf8');
  assert.ok(page.includes('fetchRelatedCatalogProducts') || page.includes('related='), 'SSR related from live catalog');

  const freightCmp = readFileSync(join(srcRoot, 'components/PdpFreightCep.tsx'), 'utf8');
  assert.ok(freightCmp.includes('/shipping/quote'), 'uses existing quote engine');
  assert.ok(freightCmp.includes('pdpFreightCheckoutFallback'), '401/error stays honest');

  const relatedCmp = readFileSync(join(srcRoot, 'components/PdpRelatedProducts.tsx'), 'utf8');
  assert.ok(relatedCmp.includes('ProductCard'), 'related rail reuses ProductCard');
  assert.ok(relatedCmp.includes('shouldShowRelatedProducts'), 'empty related hides');
  assert.ok(relatedCmp.includes('home-shelf-rail'), 'horizontal cards reuse home shelf rail');

  const css = readFileSync(join(srcRoot, 'app/globals.css'), 'utf8');
  assert.ok(css.includes('.pdp-price-trust'), 'trust under price is styled');
  assert.ok(css.includes('.pdp-freight'), 'CEP box is styled');
  assert.ok(/\.pdp\s*\{[^}]*overflow-x:\s*hidden/.test(css), 'PDP still hides page overflow');

  const ctrl = readFileSync(join(__dirname, '../../../api/src/modules/shipping/shipping.controller.ts'), 'utf8');
  assert.ok(ctrl.includes('OptionalJwtGuard'), 'quote is guest-safe for PDP');
  assert.ok(!ctrl.includes('JwtAuthGuard'), 'quote no longer requires login');
  console.log('pdp-trust: source lock — PASSOU');
}

console.log('pdp-trust unit tests ok');
