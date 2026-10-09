import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  OFFERS_DEPARTMENT_DESCRIPTION,
  departmentQueryPath,
  departmentSeo,
  isOffersDepartment,
  parseDepartmentList,
} from './department-page';

// Query path: same string for server and client; defaults sort=newest, page=1, pageSize=24.
assert.equal(departmentQueryPath({ slug: 'ofertas' }), '/products?category=ofertas&sort=newest&page=1&pageSize=24');
assert.equal(
  departmentQueryPath({ slug: 'eletro', minPrice: ' 10 ', maxPrice: '500', sort: 'price_asc', page: '3' }),
  '/products?category=eletro&minPrice=10&maxPrice=500&sort=price_asc&page=3&pageSize=24',
);
assert.equal(departmentQueryPath({ slug: 'casa', sort: 'hack', page: '-2' }), '/products?category=casa&sort=relevance&page=1&pageSize=24');

// Offers detection.
assert.equal(isOffersDepartment('ofertas'), true);
assert.equal(isOffersDepartment('Offers'), true);
assert.equal(isOffersDepartment('eletro'), false);

// SEO: ofertas never 404s and keeps a real title even with the categories API down (null).
assert.deepEqual(departmentSeo('ofertas', null, 'Lojas Schimitz'), {
  title: 'Ofertas',
  description: OFFERS_DEPARTMENT_DESCRIPTION,
  notFound: false,
});
assert.equal(departmentSeo('ofertas', { name: '', description: '', listed: false }, 'X').notFound, false);
assert.equal(departmentSeo('ofertas', { name: 'Ofertas da Semana', description: 'd', listed: true }, 'X').title, 'Ofertas da Semana');
// Other departments: unlisted → 404; API down → humanized slug, not the raw slug.
assert.equal(departmentSeo('nao-existe', { name: '', description: '', listed: false }, 'X').notFound, true);
const down = departmentSeo('eletro-portateis', null, 'Lojas Schimitz');
assert.equal(down.title, 'Eletro portateis');
assert.match(down.description, /Eletro portateis na Lojas Schimitz/);
const listed = departmentSeo('casa', { name: 'Casa', description: 'Casa na Lojas', listed: true }, 'X');
assert.deepEqual(listed, { title: 'Casa', description: 'Casa na Lojas', notFound: false });

// List envelope parsing.
assert.deepEqual(parseDepartmentList('/p', { ok: true, data: { items: [{ id: 1 }], total: 7 } }), {
  path: '/p',
  items: [{ id: 1 }],
  total: 7,
});
assert.deepEqual(parseDepartmentList('/p', { ok: true, data: [{ id: 1 }, { id: 2 }] }), { path: '/p', items: [{ id: 1 }, { id: 2 }], total: 2 });
assert.equal(parseDepartmentList('/p', { ok: false }), null);
assert.equal(parseDepartmentList('/p', { ok: true, data: { items: 'x' } }), null);
assert.equal(parseDepartmentList('/p', null), null);

// Wiring: server page renders the first list; the client reuses it without refetching.
const root = join(__dirname, '..');
const page = readFileSync(join(root, 'app/departamento/[slug]/page.tsx'), 'utf8');
const client = readFileSync(join(root, 'app/departamento/[slug]/DepartamentoClient.tsx'), 'utf8');
assert.match(page, /departmentQueryPath\(/);
assert.match(page, /<DepartamentoClient initial=\{initial\} \/>/);
assert.match(page, /departmentSeo\(/);
assert.match(client, /departmentQueryPath\(/);
assert.match(client, /skipFetchFor\.current === queryPath/);
assert.match(client, /useState<Product\[\]>\(serverList\?\.items \?\? \[\]\)/);

console.log('department-page.spec OK');
