/** Rodapé no toque: links com área ≥ 48 px (Lighthouse target-size). Guarda de fonte, mesmo estilo dos outros *-ui specs. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '..', 'app/globals.css'), 'utf8');
const block = css.slice(css.lastIndexOf('@media (pointer: coarse) {\n  .footer-col'));
assert.ok(block.length > 0, 'bloco coarse do rodapé existe');
assert.ok(/\.footer-col ul a \{[^}]*min-height: 48px/.test(block), 'link do rodapé com 48 px no toque');
assert.ok(block.includes('.footer-col ul:has(> li > a) { gap: 0; }'), 'só listas de links perdem o gap (Benefícios intacto)');
console.log('footer-tap.spec OK');
