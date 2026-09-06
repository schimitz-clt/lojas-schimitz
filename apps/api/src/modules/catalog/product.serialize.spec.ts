/**
 * Public product serializer — stock + image must match cart sources.
 */
import assert from 'assert';
import {
  availableStock,
  primaryImageUrl,
  serializePublicProduct,
} from './product.serialize';

{
  assert.equal(availableStock(null), null);
  assert.equal(availableStock(undefined), null);
  assert.equal(availableStock({ qtyOnHand: 50, qtyReserved: 0 }), 50);
  assert.equal(availableStock({ qtyOnHand: 50, qtyReserved: 7 }), 43);
  assert.equal(availableStock({ qtyOnHand: 0, qtyReserved: 0 }), 0);
  console.log('product.serialize: availableStock — PASSOU');
}

{
  assert.equal(primaryImageUrl(undefined), null);
  assert.equal(primaryImageUrl([]), null);
  assert.equal(primaryImageUrl([{ url: '  ' }]), null);
  assert.equal(
    primaryImageUrl([{ url: 'https://placehold.co/800x800?text=Roblox', position: 0 }]),
    'https://placehold.co/800x800?text=Roblox',
  );
  assert.equal(
    primaryImageUrl([
      { url: 'https://cdn.example/b.jpg', position: 2 },
      { url: 'https://cdn.example/a.jpg', position: 0 },
    ]),
    'https://cdn.example/a.jpg',
  );
  console.log('product.serialize: primaryImageUrl — PASSOU');
}

{
  const raw = {
    id: 'b4982259-15d8-47e3-bb97-8ce0c68f8939',
    slug: 'roblox',
    name: 'Roblox',
    price: '99.9',
    images: [
      {
        id: 'img1',
        url: 'https://placehold.co/800x800/1a1a1a/f5c518?text=Roblox',
        position: 0,
      },
    ],
    inventory: { qtyOnHand: 50, qtyReserved: 0, warehouse: 'origin-91250' },
    seller: { id: 's1', name: 'Lojas Schimitz', slug: 'lojas-schimitz' },
  };
  const out = serializePublicProduct(raw);
  assert.equal(out.stock, 50);
  assert.equal(out.image, 'https://placehold.co/800x800/1a1a1a/f5c518?text=Roblox');
  assert.equal(out.imageUrl, out.image);
  assert.ok(out.images?.[0]?.url);
  assert.ok(out.inventory);
  assert.equal(out.seller?.name, 'Lojas Schimitz');
  console.log('product.serialize: roblox-like shape — PASSOU');
}

{
  const bare = serializePublicProduct({
    id: 'x',
    slug: 'sem-dados',
    name: 'Sem dados',
    images: [],
    inventory: null,
  });
  assert.equal(bare.stock, null);
  assert.equal(bare.image, null);
  assert.equal(bare.imageUrl, null);
  console.log('product.serialize: missing inventory/image → null — PASSOU');
}

console.log('product.serialize.spec ok');
