/**
 * Customer order item photo/name serialization — snapshot, live fallback, placeholder skip.
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  resolveOrderItemImageUrl,
  serializeCustomerOrder,
  serializeCustomerOrderItem,
  usableOrderItemImageUrl,
} from './order-item.serialize';

const railway =
  'https://lojas-schimitz-production.up.railway.app/api/v1/uploads/cover.png';
const apex = 'https://lojasschimitz.com.br/api/v1/uploads/cover.png';
const live = 'https://cdn.example/sansung-a54.jpg';

assert.equal(usableOrderItemImageUrl(null), null);
assert.equal(usableOrderItemImageUrl('  '), null);
assert.equal(usableOrderItemImageUrl('https://placehold.co/800x800?text=A54'), null);
assert.equal(usableOrderItemImageUrl(live), live);
assert.equal(usableOrderItemImageUrl(railway), apex);

assert.equal(
  resolveOrderItemImageUrl({ imageUrl: live, product: { images: [{ url: 'https://cdn.example/other.jpg' }] } }),
  live,
  'snapshot wins when it is a real photo',
);
assert.equal(
  resolveOrderItemImageUrl({
    imageUrl: null,
    product: { images: [{ url: live, position: 0 }] },
  }),
  live,
  'historical row without snapshot uses current ProductImage',
);
assert.equal(
  resolveOrderItemImageUrl({
    imageUrl: 'https://placehold.co/800?text=old',
    product: { sku: 'A54', images: [{ url: live, position: 0 }] },
  }),
  live,
  'placeholder snapshot falls back to live cover',
);
assert.equal(
  resolveOrderItemImageUrl({
    imageUrl: railway,
    product: { images: [{ url: 'https://cdn.example/other.jpg' }] },
  }),
  apex,
  'Railway upload snapshot is rewritten to apex',
);
assert.equal(
  resolveOrderItemImageUrl({ imageUrl: null, product: { images: [] } }),
  null,
  'no photo → null (UI placeholder)',
);

const serialized = serializeCustomerOrderItem({
  id: 'i1',
  productId: 'p1',
  name: 'Sansung A54',
  qty: 1,
  unitPrice: '1899.00',
  sellerId: 's1',
  imageUrl: null,
  product: { sku: 'A54', images: [{ url: live, position: 0 }] },
});
assert.equal(serialized.productName, 'Sansung A54');
assert.equal(serialized.name, 'Sansung A54');
assert.equal(serialized.sku, 'A54');
assert.equal(serialized.imageUrl, live);
assert.equal(serialized.image, live);
assert.equal('product' in serialized, false, 'do not leak nested product on customer payload');

const order = serializeCustomerOrder({
  id: 'o1',
  publicId: 'SCH-TEST',
  items: [
    {
      id: 'i1',
      productId: 'p1',
      name: 'Sansung A54',
      qty: 1,
      unitPrice: 10,
      imageUrl: live,
    },
    {
      id: 'i2',
      productId: 'p2',
      name: 'Capa',
      qty: 1,
      unitPrice: 2,
      imageUrl: null,
      product: { images: [] },
    },
  ],
});
assert.equal(order.items[0].productName, 'Sansung A54');
assert.equal(order.items[1].imageUrl, null);

const svc = readFileSync(join(__dirname, 'orders.service.ts'), 'utf8');
assert.ok(svc.includes('serializeCustomerOrder'), 'list/get map through serializer');
assert.ok(svc.includes('ORDER_ITEM_CUSTOMER_SELECT') || svc.includes('order-item.serialize'), 'customer select/include wired');
assert.ok(svc.includes('imageUrl:'), 'create snapshots cover URL on OrderItem');

console.log('order-item.serialize: snapshot + live fallback + customer shape — PASSOU');
