import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listingSeoFor } from './seo-metadata';
import { buildProductItemList } from './json-ld';

assert.deepEqual(listingSeoFor('/produtos', {}), { path: '/produtos', index: true });
assert.deepEqual(listingSeoFor('/produtos', { page: '1' }), { path: '/produtos', index: true });
assert.deepEqual(listingSeoFor('/produtos', { page: '3' }), { path: '/produtos?page=3', index: true });
assert.deepEqual(listingSeoFor('/produtos', { page: 'x' }), { path: '/produtos', index: true });
assert.deepEqual(listingSeoFor('/produtos', { q: 'rádio' }), { path: '/produtos', index: false });
assert.deepEqual(listingSeoFor('/produtos', { q: '  ' }), { path: '/produtos', index: true });
assert.deepEqual(listingSeoFor('/departamento/eletro', { page: '2' }), { path: '/departamento/eletro?page=2', index: true });

assert.equal(buildProductItemList('https://x.com', []), null);
const il = buildProductItemList('https://x.com/', [{ slug: 'a-b', name: 'A' }, { slug: null, name: 'sem slug' }, { slug: 'c', name: 'C' }])!;
assert.equal(il['@type'], 'ItemList');
const els = il.itemListElement as { position: number; url: string }[];
assert.deepEqual(els.map((e) => e.position), [1, 2]);
assert.equal(els[0].url, 'https://x.com/produto/a-b');

const cfg = readFileSync(join(__dirname, '../../next.config.ts'), 'utf8');
assert.match(cfg, /htmlLimitedBots:\s*\/\.\*\//, 'metadados no <head> para todos (canonical fora do head é ignorado)');
console.log('seo-listing.spec ok');
