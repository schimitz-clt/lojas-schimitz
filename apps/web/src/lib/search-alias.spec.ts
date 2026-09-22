import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalogSearchAliasDestination, searchParamsToQuery } from './search-alias';

assert.equal(catalogSearchAliasDestination({ pathname: '/busca' }), '/produtos');
assert.equal(catalogSearchAliasDestination({ pathname: '/buscar' }), '/produtos');
assert.equal(catalogSearchAliasDestination({ pathname: '/busca/' }), '/produtos');
assert.equal(
  catalogSearchAliasDestination({ pathname: '/busca', search: '?q=geladeira' }),
  '/produtos?q=geladeira',
);
assert.equal(
  catalogSearchAliasDestination({ pathname: '/buscar', search: 'q=ar%20condicionado' }),
  '/produtos?q=ar%20condicionado',
);
assert.equal(
  catalogSearchAliasDestination({ pathname: '/busca', search: '?q=tv&sort=price' }),
  '/produtos?q=tv&sort=price',
);
assert.equal(catalogSearchAliasDestination({ pathname: '/busca', search: '?q=' }), '/produtos?q=');
assert.equal(catalogSearchAliasDestination({ pathname: '/produtos', search: '?q=tv' }), null);
assert.equal(catalogSearchAliasDestination({ pathname: '/busca/extra', search: '?q=tv' }), null);
assert.equal(searchParamsToQuery({ q: 'geladeira frost' }), '?q=geladeira+frost');
assert.equal(searchParamsToQuery({}), '');
assert.equal(
  catalogSearchAliasDestination({ pathname: '/buscar', search: searchParamsToQuery({ q: 'tv' }) }),
  '/produtos?q=tv',
);

const srcRoot = join(__dirname, '..');
const mw = readFileSync(join(srcRoot, 'middleware.ts'), 'utf8');
assert.ok(mw.includes('catalogSearchAliasDestination'), 'middleware redirects /busca and /buscar');
assert.ok(mw.includes('307'), 'search alias redirect is HTTP 307');

const busca = readFileSync(join(srcRoot, 'app/busca/page.tsx'), 'utf8');
const buscar = readFileSync(join(srcRoot, 'app/buscar/page.tsx'), 'utf8');
assert.ok(busca.includes("pathname: '/busca'"), '/busca route redirects with the helper');
assert.ok(buscar.includes("pathname: '/buscar'"), '/buscar route redirects with the helper');
assert.ok(busca.includes('redirect('), '/busca uses a redirect');
assert.ok(buscar.includes('redirect('), '/buscar uses a redirect');

console.log('search-alias unit tests ok');
