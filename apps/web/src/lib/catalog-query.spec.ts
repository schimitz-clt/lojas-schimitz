import assert from 'node:assert/strict';
import { catalogQueryPath, unwrapCatalogList } from './catalog-query';

const from = (o: Record<string, string>) => (k: string) => o[k];
assert.equal(catalogQueryPath(from({})), '/products?page=1&pageSize=' + new URLSearchParams(catalogQueryPath(from({})).split('?')[1]).get('pageSize'));
const p = catalogQueryPath(from({ q: 'tv', seller: ' LOJA ', sort: 'relevance', page: '2' }));
assert.ok(p.includes('q=tv') && p.includes('seller=loja') && !p.includes('sort=') && p.includes('page=2'));
assert.deepEqual(unwrapCatalogList({ success: true, data: { items: [1, 2], total: 9 } }), { items: [1, 2], total: 9 });
assert.deepEqual(unwrapCatalogList({ data: [1] }), { items: [1], total: 1 });
assert.equal(unwrapCatalogList({ data: 'x' }), null);
assert.equal(unwrapCatalogList(null), null);
console.log('catalog-query OK');
