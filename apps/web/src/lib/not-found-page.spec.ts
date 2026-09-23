import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = readFileSync(join(__dirname, '..', 'app', 'not-found.tsx'), 'utf8');
const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

assert.ok(page.includes('Página não encontrada'), '404 heading is Portuguese');
assert.ok(page.includes('Esse endereço não existe ou o produto saiu do ar.'), '404 explains missing routes and products');
assert.ok(page.includes('href="/"'), '404 offers the home page');
assert.ok(page.includes('href="/produtos"'), '404 offers the catalog');
assert.ok(page.includes('Ir para o início'), 'home CTA copy');
assert.ok(page.includes('Ver produtos'), 'catalog CTA copy');
assert.ok(page.includes("title: 'Página não encontrada'"), 'document title is Portuguese');
assert.ok(!/could not be found/i.test(page), 'default English Next.js 404 copy is gone');
assert.ok(!/100vh/.test(page), '404 does not force a full viewport blank');
assert.ok(css.includes('.not-found'), '404 is styled in the storefront sheet');
assert.ok(/\.not-found-kicker[\s\S]*background:\s*var\(--yellow\)/.test(css), '404 kicker uses Schimitz yellow');

console.log('not-found page unit tests ok');
