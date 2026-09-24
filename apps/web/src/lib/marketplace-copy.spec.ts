import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MARKETPLACE_PHASE1_NOTE,
  MARKETPLACE_PHASE2_NOTE,
  MARKETPLACE_PHASE3_NOTE,
  MARKETPLACE_V1_NOT_BUILT,
  isHouseBrandOnly,
  marketplaceEmptySellersCopy,
  marketplaceIntro,
  marketplaceSellersHeading,
  sellerProductCountLabel,
  normalizePublicSellers,
  uniqueSellersFromProducts,
} from './marketplace-copy';

const house = { id: '1', name: 'Lojas Schimitz', slug: 'lojas-schimitz', productCount: 9 };
assert.equal(isHouseBrandOnly([house]), true);
assert.equal(isHouseBrandOnly([]), false);
assert.equal(
  isHouseBrandOnly([house, { id: '2', name: 'Parceiro', slug: 'parceiro' }]),
  false,
);
assert.equal(marketplaceSellersHeading([house]), 'Vendedor atual');
assert.equal(marketplaceSellersHeading([house, { id: '2', name: 'Parceiro', slug: 'parceiro' }]), 'Vendedores ativos');
assert.equal(sellerProductCountLabel(0), 'Sem anúncios no momento');
assert.equal(sellerProductCountLabel(1), '1 produto');
assert.equal(sellerProductCountLabel(100), '100 produtos');
assert.equal(sellerProductCountLabel(undefined), null);
const emptySellers = marketplaceEmptySellersCopy();
assert.ok(/nenhum vendedor/i.test(emptySellers.title));
assert.ok(/fictíc/i.test(emptySellers.body));
assert.ok(marketplaceIntro([house]).includes('loja própria'));
assert.ok(!marketplaceIntro([house]).includes('vendedores parceiros'));

const fromProducts = uniqueSellersFromProducts([
  { seller: { id: '1', name: 'Lojas Schimitz', slug: 'lojas-schimitz' } },
  { seller: { id: '1', name: 'Lojas Schimitz', slug: 'lojas-schimitz' } },
  { seller: null },
]);
assert.equal(fromProducts.length, 1);
assert.equal(fromProducts[0]?.productCount, 2);

assert.deepEqual(
  normalizePublicSellers([
    { id: '1', name: 'Lojas Schimitz', slug: 'lojas-schimitz', productCount: 9, ownerEmail: 'secret' },
    { id: '', name: 'Nope', slug: 'x' },
  ]),
  [{ id: '1', name: 'Lojas Schimitz', slug: 'lojas-schimitz', productCount: 9 }],
);

for (const item of MARKETPLACE_V1_NOT_BUILT) {
  assert.ok(item.length > 4);
}

const page = readFileSync(join(__dirname, '..', 'app/marketplace/page.tsx'), 'utf8');
assert.ok(page.includes('fetchPublicSellers'), 'hub lists real sellers from API');
assert.ok(page.includes('MARKETPLACE_V1_NOT_BUILT'), 'hub lists what v1 does not do');
assert.ok(page.includes('checkout único') || page.includes('unificados'), 'hub says checkout is unified');
assert.ok(!/split automático do Mercado Pago já/.test(page), 'must not claim live MP split');
assert.ok(page.includes('PIX manual'), 'hub says payouts are manual PIX');
assert.ok(page.includes('MARKETPLACE_PHASE1_NOTE') || page.includes('Fase 1'), 'hub mentions Phase 1');
assert.ok(page.includes('MARKETPLACE_PHASE2_NOTE') || page.includes('Fase 2'), 'hub mentions Phase 2 sandbox');
assert.ok(page.includes('MARKETPLACE_PHASE3_NOTE') || page.includes('Fase 3'), 'hub mentions Phase 3 live gate');
assert.ok(MARKETPLACE_PHASE1_NOTE.includes('MP_MARKETPLACE_SPLIT_ENABLED'));
assert.ok(MARKETPLACE_PHASE2_NOTE.includes('ALLOW_LIVE=false'));
assert.ok(MARKETPLACE_PHASE2_NOTE.includes('TEST-'));
assert.ok(!MARKETPLACE_PHASE2_NOTE.includes('ALLOW_LIVE=true'));
assert.ok(MARKETPLACE_PHASE3_NOTE.includes('ALLOW_LIVE=true'));
assert.ok(MARKETPLACE_PHASE3_NOTE.includes('ledger_only'));
assert.ok(MARKETPLACE_PHASE3_NOTE.includes('Rollback'));
assert.ok(MARKETPLACE_V1_NOT_BUILT.every((item) => !/oauth/i.test(item)));
assert.ok(page.includes('portal do vendedor'), 'hub links /vendedor');
assert.ok(page.includes('Vendido por'), 'hub mentions PDP seller label');
assert.ok(page.includes('marketplaceEmptySellersCopy'), 'empty seller directory uses the helper');
assert.ok(page.includes('sellerProductCountLabel'), 'zero listings are not shown as 0 produto(s)');
assert.ok(!page.includes('produto(s)'), 'marketplace count is not the raw 0 produto(s) string');

const admin = readFileSync(
  join(__dirname, '..', 'components/admin/sections/AdminMarketplaceSection.tsx'),
  'utf8',
);
assert.ok(admin.includes('Comissão %'), 'admin can set commission percent');
assert.ok(admin.includes('Criar vendedor'), 'admin can create sellers');
assert.ok(admin.includes('Vincular dono') || admin.includes('Salvar dono'), 'admin can assign owner');
assert.ok(admin.includes('Exportar CSV'), 'admin can export commission CSV');
assert.ok(
  admin.includes('ALLOW_LIVE') || admin.includes('split live'),
  'admin mentions gated live split, not a silent claim that it is already on',
);
assert.ok(!admin.includes('Sem split Mercado Pago em produção'), 'admin must not say live split is off');
assert.ok(!admin.includes('split MP sandbox'), 'application_fee rows are not sandbox-only');
assert.ok(admin.includes('comissão da plataforma'), 'ledger amount is labeled as platform commission');
assert.ok(admin.includes('sellerMpOAuthLabel'), 'admin seller list shows MP OAuth status');

console.log('marketplace-copy unit tests ok');
