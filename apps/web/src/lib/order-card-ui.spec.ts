import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  extraItemsCount,
  extraItemsHonestLabel,
  extraItemsLabel,
  inProgressOrderCardSummary,
  orderCardPrimaryImageUrl,
  orderCardDescription,
  orderCardImageUrl,
  orderCardImageUrls,
  orderCardPrimaryName,
  orderCardSecondaryLine,
  orderCardTitle,
  orderCardTitleOrCode,
  orderItemDescription,
  orderItemDisplayName,
  orderItemImageUrl,
  shortOrderCardDescription,
} from './order-card-ui';

assert.equal(orderItemDisplayName({ name: 'Sansung A54' }), 'Sansung A54');
assert.equal(orderItemDisplayName({ productName: 'Sansung A54', name: 'SKU-1' }), 'Sansung A54');
assert.equal(orderItemDisplayName({ name: '  ' }), '');

assert.equal(orderCardTitle([{ name: 'Sansung A54' }]), 'Sansung A54');
assert.equal(
  orderCardTitle([{ name: 'Sansung A54' }, { name: 'Capa' }]),
  'Sansung A54 e mais 1',
);
assert.equal(
  orderCardTitle([{ name: 'Sansung A54' }, { name: 'Capa' }, { name: 'Película' }]),
  'Sansung A54 e mais 2',
);
assert.equal(orderCardTitle([]), '');
assert.equal(orderCardTitleOrCode({ publicId: 'SCH-ABC', items: [] }), 'SCH-ABC');
assert.equal(
  orderCardTitleOrCode({ publicId: 'SCH-ABC', items: [{ name: 'Sansung A54' }] }),
  'Sansung A54',
);

assert.equal(extraItemsCount([{ name: 'A' }, { name: 'B' }]), 1);
assert.equal(extraItemsLabel(0), null);
assert.equal(extraItemsLabel(1), '+1');
assert.equal(extraItemsLabel(2), '+2');
assert.equal(extraItemsHonestLabel(0), null);
assert.equal(extraItemsHonestLabel(1), '+1 item');
assert.equal(extraItemsHonestLabel(2), '+2 itens');

assert.equal(
  orderCardPrimaryName({
    publicId: 'SCH-ABC',
    items: [{ name: 'Sansung A54' }, { name: 'Capa' }],
  }),
  'Sansung A54',
);
assert.equal(orderCardPrimaryName({ publicId: 'SCH-ABC', items: [] }), 'SCH-ABC');

assert.equal(orderItemDescription({ name: 'A54', description: ' Dual chip 128GB ' }), 'Dual chip 128GB');
assert.equal(orderItemDescription({ name: 'A54', product: { description: 'Tela Super AMOLED' } }), 'Tela Super AMOLED');
assert.equal(orderItemDescription({ name: 'A54' }), '');
assert.equal(orderCardDescription([{ name: 'A54', description: 'Compacto' }]), 'Compacto');
assert.equal(
  orderCardSecondaryLine({ items: [{ name: 'Sansung A54', description: 'Sansung A54' }] }),
  '',
  'do not repeat the title as description',
);
assert.equal(
  shortOrderCardDescription(
    'Smartphone com tela Super AMOLED de 6.4 polegadas, 128GB de armazenamento, câmera tripla e bateria de longa duração para o dia a dia.',
  ).endsWith('…'),
  true,
);
assert.ok(shortOrderCardDescription('x'.repeat(200)).length <= 98);

const live = 'https://cdn.example/a54.jpg';
const inProgress = inProgressOrderCardSummary({
  publicId: 'SCH-MU8',
  items: [
    { name: 'Sansung A54', description: 'Dual chip 128GB', imageUrl: live },
    { name: 'Capa' },
  ],
});
assert.equal(inProgress.title, 'Sansung A54');
assert.equal(inProgress.description, 'Dual chip 128GB');
assert.equal(inProgress.imageUrl, live);
assert.equal(inProgress.extraLabel, '+1 item');
assert.equal(inProgress.publicId, 'SCH-MU8');
assert.equal(
  orderCardPrimaryImageUrl([
    { name: 'A', imageUrl: 'https://placehold.co/1' },
    { name: 'B', imageUrl: live },
  ]),
  '',
  'Conta photo stays on the first product (no later-item swap)',
);
assert.equal(orderItemImageUrl({ imageUrl: live }), live);
assert.equal(orderItemImageUrl({ imageUrl: 'https://placehold.co/800?text=A54' }), '');
assert.equal(
  orderItemImageUrl({
    imageUrl: null,
    product: { images: [{ url: live, position: 0 }] },
  }),
  live,
);
assert.equal(
  orderCardImageUrl([
    { name: 'A', imageUrl: 'https://placehold.co/1' },
    { name: 'B', imageUrl: live },
  ]),
  live,
  'first usable photo if first line has no real cover',
);
assert.deepEqual(orderCardImageUrls([{ imageUrl: live }, { imageUrl: 'https://cdn.example/b.jpg' }]), [
  live,
  'https://cdn.example/b.jpg',
]);

const railway =
  'https://lojas-schimitz-production.up.railway.app/api/v1/uploads/a54.png';
assert.equal(orderItemImageUrl({ imageUrl: railway }), 'https://lojasschimitz.com.br/api/v1/uploads/a54.png');

const page = readFileSync(join(__dirname, '../app/pedidos/page.tsx'), 'utf8');
assert.ok(page.includes('orderCardTitleOrCode'), 'Meus pedidos title is product name');
assert.ok(page.includes('orderCardImageUrl') || page.includes('order-card-thumb'), 'Meus pedidos shows product photo');
assert.ok(page.includes('o.publicId'), 'order code remains as secondary');
assert.equal(page.includes('<b>{o.publicId}</b>'), false, 'order code is not the card hero');
assert.ok(page.includes('orderStatusLabel'), 'status still visible');
assert.ok(page.includes('brl(o.total)'), 'total still visible');

const conta = readFileSync(join(__dirname, '../app/conta/page.tsx'), 'utf8');
assert.ok(conta.includes('inProgressOrderCardSummary'), 'Conta in-progress uses product summary');
assert.ok(conta.includes('OrderCardThumb') || conta.includes('order-card-thumb'), 'Conta in-progress shows photo');
assert.ok(conta.includes('activeCard.title'), 'Conta leads with product name');
assert.ok(conta.includes('activeCard.description'), 'Conta shows short description');
assert.ok(conta.includes('activeCard.extraLabel'), 'Conta can show +N itens');
assert.ok(conta.includes('Acompanhar'), 'Acompanhar remains');
assert.ok(conta.includes('Meus pedidos'), 'Meus pedidos remains');
assert.equal(conta.includes('Código: <b>{activeOrder.publicId}</b>'), false, 'order code is not the Conta hero');
assert.ok(conta.includes('orderStatusLabel'), 'Conta keeps payment/status line');
assert.ok(conta.includes('brl(activeOrder.total)'), 'Conta keeps total');

const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
assert.ok(css.includes('.order-card-thumb'), 'order card thumb styles');
assert.ok(css.includes('.order-card-title'), 'order card title styles');

const theme = readFileSync(join(__dirname, '../components/storefront/storefront-theme.css'), 'utf8');
assert.ok(theme.includes('.account-hub-progress-product'), 'Conta product row');
assert.ok(theme.includes('.account-hub-progress-name'), 'Conta product name');
assert.ok(theme.includes('.account-hub-progress-desc'), 'Conta short description');
assert.ok(theme.includes('overflow-x: hidden'), 'account hub clips horizontal overflow');

console.log('order-card-ui: product name + photo cards — PASSOU');
