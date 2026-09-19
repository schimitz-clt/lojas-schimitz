import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MARKETPLACE_PHASE1_NOTE,
  MARKETPLACE_V1_NOT_BUILT,
  isHouseBrandOnly,
  marketplaceIntro,
  marketplaceSellersHeading,
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
assert.ok(MARKETPLACE_PHASE1_NOTE.includes('MP_MARKETPLACE_SPLIT_ENABLED'));
assert.ok(!MARKETPLACE_V1_NOT_BUILT.some((i) => i === 'OAuth de vendedores'));
assert.ok(page.includes('portal do vendedor'), 'hub links /vendedor');
assert.ok(page.includes('Vendido por'), 'hub mentions PDP seller label');

const admin = readFileSync(
  join(__dirname, '..', 'components/admin/sections/AdminMarketplaceSection.tsx'),
  'utf8',
);
assert.ok(admin.includes('Comissão %'), 'admin can set commission percent');
assert.ok(admin.includes('Criar vendedor'), 'admin can create sellers');
assert.ok(admin.includes('Vincular dono') || admin.includes('Salvar dono'), 'admin can assign owner');
assert.ok(admin.includes('Exportar CSV'), 'admin can export commission CSV');
assert.ok(admin.includes('sem split MP') || admin.includes('Sem split Mercado Pago'), 'admin does not claim MP split');

console.log('marketplace-copy unit tests ok');
