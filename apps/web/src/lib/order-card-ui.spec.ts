import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  extraItemsCount,
  extraItemsLabel,
  orderCardImageUrl,
  orderCardImageUrls,
  orderCardTitle,
  orderCardTitleOrCode,
  orderItemDisplayName,
  orderItemImageUrl,
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

const live = 'https://cdn.example/a54.jpg';
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

const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
assert.ok(css.includes('.order-card-thumb'), 'order card thumb styles');
assert.ok(css.includes('.order-card-title'), 'order card title styles');

console.log('order-card-ui: product name + photo cards — PASSOU');
