/**
 * Guarda: o build do web não pode depender do Google Fonts. Com `next/font/google` o `next build`
 * baixa as fontes na hora; quando o download falhava (CI em 09/10/2026: "An error occurred in
 * `next/font`"), o build quebrava, e o mesmo podia acontecer num deploy do Railway.
 * As fontes ficam em src/app/fonts (OFL, ver LICENCAS.md) e entram por `next/font/local`.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const src = join(__dirname, '..');
const SKIP = new Set(['node_modules', '.next']);
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|jsx?|css)$/.test(name) && !name.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

const offenders = walk(src).filter((f) => {
  const s = readFileSync(f, 'utf8');
  return /from\s+['"]next\/font\/google['"]/.test(s) || /fonts\.(googleapis|gstatic)\.com/.test(s);
});
assert.deepEqual(offenders, [], `build não pode baixar fontes do Google: ${offenders.join(', ')}`);

const layout = readFileSync(join(src, 'app/layout.tsx'), 'utf8');
assert.match(layout, /from 'next\/font\/local'/);
for (const m of layout.matchAll(/'\.\/fonts\/([^']+\.woff2)'/g)) {
  const file = join(src, 'app/fonts', m[1]);
  assert.ok(existsSync(file), `fonte ausente: ${m[1]}`);
  const head = readFileSync(file).subarray(0, 4).toString('latin1');
  assert.equal(head, 'wOF2', `${m[1]} não é woff2`);
}
for (const v of ['--font-schimitz', '--font-display', '--font-mono']) {
  assert.ok(layout.includes(`variable: '${v}'`), `variável CSS ${v} sumiu do layout`);
}

console.log('fonts-self-hosted.spec ok');
