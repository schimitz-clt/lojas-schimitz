import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RELATED_PRODUCTS_MAX,
  STOREFRONT_CEP_KEY,
  assembleRelatedProducts,
  bestsellersFromHomeShelves,
  cepDigits,
  formatCepInput,
  isCompleteCep,
  parseCatalogProductItems,
  persistStoredCep,
  pdpBenefitTrustItems,
  pdpCompactTrustChips,
  pdpFreightCheckoutFallback,
  pdpFreightDestinationLine,
  freightCustomerLines,
  pdpFreightEstimateRow,
  pdpFreightIdleCopy,
  pdpFreightPlaceName,
  pdpFreightResultCopy,
  pdpLowStockUrgency,
  pdpPriceTrustLines,
  pdpStockLine,
  pickRelatedProducts,
  readStoredCep,
  relatedProductsCopy,
  relatedProductsHref,
  relatedShelfLink,
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
  assert.equal(relatedProductsCopy('category').title, 'Quem viu também viu');
  assert.ok(/categoria/i.test(relatedProductsCopy('category').subtitle));
  assert.equal(relatedProductsCopy('bestsellers').title, 'Quem viu também viu');
  assert.ok(/mais vendidos/i.test(relatedProductsCopy('bestsellers').subtitle));
  assert.ok(!/comprou/i.test(relatedProductsCopy('catalog').title));
  assert.ok(!/comprou/i.test(relatedProductsCopy('bestsellers').title));
  assert.equal(relatedProductsHref('eletro'), '/departamento/eletro');
  assert.equal(relatedProductsHref(''), '/produtos');
  assert.equal(relatedProductsHref('eletro', 'bestsellers'), '/produtos?sort=relevance');
  assert.equal(relatedShelfLink('category', 'eletro', 'Eletro').label, 'Ver Eletro');
  assert.equal(relatedShelfLink('bestsellers').href, '/produtos?sort=relevance');
  assert.equal(relatedShelfLink('bestsellers').label, 'Ver mais vendidos');

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

  const shelf = assembleRelatedProducts(
    { id: 'tv', slug: 'tv-a', categorySlug: 'eletro' },
    {
      category: [
        { id: 'tv', slug: 'tv-a', category: { slug: 'eletro' } },
        { id: 'sound', slug: 'sound', category: { slug: 'eletro' } },
        { id: 'fridge', slug: 'fridge', category: { slug: 'eletro' } },
      ],
      bestsellers: [{ id: 'best', slug: 'best', category: { slug: 'casa' } }],
    },
  );
  assert.equal(shelf.kind, 'category');
  assert.deepEqual(
    shelf.items.map((p) => p.id),
    ['sound', 'fridge'],
  );

  const fallback = assembleRelatedProducts(
    { id: 'solo', slug: 'solo', categorySlug: 'eletro' },
    {
      category: [{ id: 'solo', slug: 'solo', category: { slug: 'eletro' } }],
      bestsellers: [
        { id: 'best', slug: 'best', category: { slug: 'casa' } },
        { id: 'best-2', slug: 'best-2', category: { slug: 'casa' } },
      ],
      catalog: [{ id: 'other', slug: 'other', category: { slug: 'moveis' } }],
    },
  );
  assert.equal(fallback.kind, 'bestsellers');
  assert.deepEqual(
    fallback.items.map((p) => p.id),
    ['best', 'best-2'],
  );

  const oneNeighbor = assembleRelatedProducts(
    { id: 'tv', slug: 'tv-a', categorySlug: 'eletro' },
    {
      category: [
        { id: 'tv', slug: 'tv-a', category: { slug: 'eletro' } },
        { id: 'sound', slug: 'sound', category: { slug: 'eletro' } },
      ],
      bestsellers: [
        { id: 'best', slug: 'best', category: { slug: 'casa' } },
        { id: 'best-2', slug: 'best-2', category: { slug: 'casa' } },
      ],
    },
  );
  assert.equal(oneNeighbor.kind, 'category');
  assert.equal(oneNeighbor.items[0].id, 'sound');
  assert.ok(oneNeighbor.items.some((p) => p.id === 'best'));

  const catalogFill = assembleRelatedProducts(
    { id: 'solo', slug: 'solo', categorySlug: 'eletro' },
    {
      category: [],
      bestsellers: [],
      catalog: [{ id: 'other', slug: 'other', category: { slug: 'moveis' } }],
    },
  );
  assert.equal(catalogFill.kind, 'catalog');
  assert.equal(catalogFill.items[0].id, 'other');

  const ranked = bestsellersFromHomeShelves({
    shelves: [
      {
        id: 'featured',
        title: 'Mais vendidos',
        metric: 'paid_qty',
        items: [{ id: 'sold' }, { id: '' }],
      },
    ],
  });
  assert.deepEqual(
    ranked.map((p) => p.id),
    ['sold'],
  );
  assert.deepEqual(
    bestsellersFromHomeShelves({
      shelves: [{ id: 'featured', title: 'Em destaque', metric: 'newest', items: [{ id: 'new' }] }],
    }),
    [],
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
  assert.equal(idle.title, 'Frete e prazo');
  assert.ok(/CEP/i.test(idle.body));

  const chips = pdpCompactTrustChips('Schimitz');
  assert.deepEqual(
    chips.map((chip) => chip.label),
    ['Vendido por Schimitz', 'Troca em 7 dias', 'Garantia e qualidade'],
  );
  assert.equal(chips[1].href, '/termos');
  assert.equal(chips[2].href, '/suporte');
  assert.equal(pdpCompactTrustChips('').find((chip) => chip.id === 'seller')?.label, 'Lojas Schimitz');
  assert.ok(!chips.some((chip) => /pessoas vendo|100%|selo/i.test(chip.label)));
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
  assert.ok(/Receba em 1 dia/.test(free.detail));
  assert.ok(!/após o despacho/.test(free.detail));
  assert.ok(/90/.test(free.detail));

  const paid = pdpFreightResultCopy({ price: 19.9, days: 5, label: 'Correios · PAC' });
  assert.equal(paid.title, 'Frete: R$ 19,90');
  assert.ok(/Receba em 5 dias/.test(paid.detail));
  assert.ok(!/após o despacho/.test(paid.detail));

  assert.equal(pdpFreightPlaceName('Porto Alegre — frete grátis'), 'Porto Alegre');
  assert.equal(pdpFreightPlaceName('Entrega própria — R$ 19,90'), '');
  assert.equal(
    pdpFreightDestinationLine('90010-000', 'Porto Alegre — frete grátis'),
    'Enviar para Porto Alegre · 90010-000',
  );
  assert.equal(pdpFreightDestinationLine('90010000', null), 'Enviar para 90010-000');
  assert.equal(pdpFreightDestinationLine('', null), 'Informe o CEP de entrega');
  const freeRow = pdpFreightEstimateRow({
    price: 0,
    days: 2,
    label: 'Porto Alegre — frete grátis',
    matchedPrefix: '90',
  });
  assert.equal(freeRow.eta, 'em 2 dias');
  assert.equal(freeRow.price, 'Grátis');
  assert.ok(!/após o despacho/.test(`${freeRow.eta} ${freeRow.note}`));
  assert.ok(!/segunda|setembro|retire na loja/i.test(`${freeRow.eta} ${freeRow.note}`));
  const oneDay = pdpFreightEstimateRow({
    price: 0,
    days: 1,
    label: 'Porto Alegre (91) — frete grátis',
    matchedPrefix: '91',
  });
  assert.equal(oneDay.eta, 'em 1 dia');
  assert.equal(oneDay.price, 'Grátis');
  assert.equal(`Receba ${oneDay.eta}`, 'Receba em 1 dia');
  assert.ok(!/após o despacho/.test(`${oneDay.eta} ${oneDay.note}`));
  assert.equal(
    pdpFreightEstimateRow({ price: 19.9, days: 5, label: 'Correios · PAC' }).price,
    'R$ 19,90',
  );
  assert.equal(
    pdpFreightEstimateRow({ price: 22.1, days: 4, carrier: 'Correios', service: 'SEDEX' }).eta,
    'em 4 dias',
  );

  const poaLines = freightCustomerLines({
    price: 0,
    days: 1,
    label: 'Porto Alegre (91) — frete grátis',
    carrier: 'Correios',
    service: 'PAC',
    modality: 'gratis',
  });
  assert.equal(poaLines.priceLabel, 'Frete grátis');
  assert.equal(poaLines.eta, 'Receba em 1 dia');
  assert.equal(poaLines.prazo, 'Prazo: 1 dia');
  assert.ok(/Porto Alegre/.test(poaLines.detail));
  assert.ok(!/após o despacho|taxa padrão/i.test(`${poaLines.eta} ${poaLines.prazo} ${poaLines.detail}`));
  const paidLines = freightCustomerLines({
    price: 22.1,
    days: 4,
    carrier: 'Correios',
    service: 'SEDEX',
    modality: 'SEDEX',
  });
  assert.equal(paidLines.priceLabel, 'Frete: R$ 22,10');
  assert.equal(paidLines.eta, 'Receba em 4 dias');
  assert.equal(paidLines.prazo, 'Prazo: 4 dias');
  assert.ok(/Correios/.test(paidLines.detail));
  assert.ok(/SEDEX/.test(paidLines.detail));
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
  assert.ok(pdp.includes('pdpCompactTrustChips'), 'PDP trust is a compact chip strip');
  assert.ok(pdp.includes('no PIX'), 'PIX price leads the offer');
  assert.ok(pdp.includes('highlight.tag'), 'PIX keeps the 5% OFF chip');
  assert.ok(pdp.includes("' em '"), 'list price and parcelas share one ou line');
  assert.ok(pdp.includes('pdp-list-price'), 'list price stays scannable under PIX');
  assert.ok(pdp.includes('className="pdp-seller'), 'seller line stays under the title');
  assert.ok(pdp.includes('Falar com a loja'), 'WhatsApp store contact stays');
  assert.ok(pdp.includes('PdpFreightCep'), 'PDP wires existing CEP quote UI');
  assert.ok(pdp.includes('PdpRelatedProducts'), 'PDP shows related catalog products');
  assert.ok(pdp.includes('pdpLowStockUrgency'), 'PDP urgency uses real stock ≤3');
  assert.ok(pdp.includes('ProductGallery'), 'gallery stays');
  assert.equal(pdp.includes('pdp-sticky-atc'), false, 'PDP has no fixed purchase bar');
  assert.ok(pdp.includes('pdp-cta-primary'), 'Adicionar à sacola stays in the scrolling buy box');
  assert.ok(pdp.includes('pdp-cta-buy-now'), 'Comprar agora stays in the scrolling buy box');
  assert.ok(pdp.includes('ProductShareButton'), 'share stays');
  assert.ok(pdp.includes('pixPrice('), 'PIX stack stays');
  assert.ok(!/pessoas vendo|visualizando agora/i.test(pdp), 'no fake viewer counts');
  assert.ok(!/Melhor Envio|Correios API/i.test(pdp), 'no invented carrier');

  const page = readFileSync(join(srcRoot, 'app/produto/[slug]/page.tsx'), 'utf8');
  assert.ok(page.includes('fetchRelatedCatalogProducts') || page.includes('related='), 'SSR related from live catalog');

  const freightCmp = readFileSync(join(srcRoot, 'components/PdpFreightCep.tsx'), 'utf8');
  assert.ok(freightCmp.includes('/shipping/quote'), 'uses existing quote engine');
  assert.ok(freightCmp.includes('pdpFreightCheckoutFallback'), '401/error stays honest');
  assert.ok(freightCmp.includes('pdp-freight-estimate'), 'quote renders as an estimate row');
  assert.ok(freightCmp.includes('pdpFreightDestinationLine'), 'destination uses the saved CEP');
  assert.ok(freightCmp.includes('alterar'), 'CEP can be changed without a second address form');
  assert.ok(!/retire na loja/i.test(freightCmp), 'no store pickup row');
  assert.ok(freightCmp.includes('Receba '), 'PDP prefixes Receba');
  assert.ok(!/após o despacho/.test(freightCmp), 'PDP freight has no após o despacho');

  const checkout = readFileSync(join(srcRoot, 'app/checkout/page.tsx'), 'utf8');
  assert.ok(checkout.includes('freightCustomerLines'), 'checkout uses the same freight copy');
  assert.ok(!checkout.includes('formatDaysAfterDispatch'), 'checkout does not use após o despacho helper');
  assert.ok(!/após o despacho/.test(checkout), 'checkout freight has no após o despacho');
  assert.ok(!/taxa padrão/.test(checkout), 'checkout does not present the flat default fee');
  assert.ok(checkout.includes('const canConfirm = freightReady'), 'pay CTA waits for a settled quote');
  assert.ok(checkout.includes('Calcule o frete deste endereço antes de pagar'), 'submit refuses unsettled freight');
  const summaryAt = checkout.indexOf('checkout-pay-heading');
  const payAt = checkout.indexOf('Confirmar pedido e pagar');
  assert.ok(summaryAt > 0 && payAt > summaryAt, 'payment summary sits before the pay CTA');
  const summary = checkout.slice(summaryAt, payAt);
  assert.ok(summary.includes('freightLines.eta'), 'totals show prazo before pay');
  assert.ok(summary.includes('freightLines.prazo'), 'totals repeat Prazo: N dias before pay');
  assert.ok(summary.includes('freightLines.priceLabel'), 'totals show freight price before pay');
  assert.ok(freightCmp.includes('STOREFRONT_CEP_KEY') || freightCmp.includes('readStoredCep'), 'reuses sch_cep');

  const relatedCmp = readFileSync(join(srcRoot, 'components/PdpRelatedProducts.tsx'), 'utf8');
  assert.ok(relatedCmp.includes('ProductCard'), 'related rail reuses ProductCard');
  assert.ok(relatedCmp.includes('shouldShowRelatedProducts'), 'empty related hides');
  assert.ok(relatedCmp.includes('home-shelf-rail'), 'horizontal cards reuse home shelf rail');
  assert.ok(relatedCmp.includes('/store/shelves'), 'mais vendidos fallback uses the home shelf API');
  assert.ok(relatedCmp.includes('assembleRelatedProducts'), 'related shelf uses the catalog assembler');
  assert.ok(relatedCmp.includes('variant="shelf"'), 'related cards reuse the shelf density');

  const css = readFileSync(join(srcRoot, 'app/globals.css'), 'utf8');
  assert.ok(css.includes('.pdp-price-trust'), 'trust under price is styled');
  assert.ok(css.includes('.pdp-pix-kicker'), 'PIX kicker is styled in the Schimitz palette');
  assert.ok(css.includes('.pdp-freight-estimate'), 'freight estimate row is styled');
  assert.ok(css.includes('.pdp-freight'), 'CEP box is styled');
  assert.ok(/\.pdp\s*\{[^}]*overflow-x:\s*hidden/.test(css), 'PDP still hides page overflow');

  const ctrl = readFileSync(join(__dirname, '../../../api/src/modules/shipping/shipping.controller.ts'), 'utf8');
  assert.ok(ctrl.includes('OptionalJwtGuard'), 'quote is guest-safe for PDP');
  assert.ok(!ctrl.includes('JwtAuthGuard'), 'quote no longer requires login');
  console.log('pdp-trust: source lock — PASSOU');
}

console.log('pdp-trust unit tests ok');
