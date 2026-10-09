import assert from 'assert';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import {
  CARD_INSTALLMENTS_HIGHLIGHT,
  cardInstallmentClaim,
  cardInstallmentPhrase,
  cardInstallmentShort,
} from './pricing';
import { departmentEmptyCopy, homeEmptyCopy, searchEmptyCopy } from './storefront-pro';

// ---- parcelamento no cartão: uma fonte só (pricing.ts); NÃO promete "sem juros" ----
assert.equal(CARD_INSTALLMENTS_HIGHLIGHT, 3);
assert.equal(cardInstallmentShort(), '3x no cartão');
assert.equal(cardInstallmentPhrase(), 'parcele em até 3x no cartão');
assert.equal(cardInstallmentClaim(), 'Parcele em até 3x no cartão');

const src = join(__dirname, '..');
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(name) && !/\.spec\.tsx?$/.test(name) ? [p] : [];
  });
}
// A frase de marketing do parcelamento só pode ser escrita em lib/pricing.ts.
const offenders: string[] = [];
for (const file of walk(src)) {
  const rel = relative(src, file);
  if (rel === join('lib', 'pricing.ts')) continue;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '').replace(/\/\*.*?\*\//g, '');
      if (/parcele em at[eé]|em at[eé] \d+x no cart/i.test(code)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
    });
}
assert.deepEqual(offenders, [], `a frase de parcelamento deve vir de lib/pricing.ts:\n${offenders.join('\n')}`);

// ---- empty states: no duplicated sentences, search title cites the query ----
const s = searchEmptyCopy('geladeira', false);
assert.equal(s.title, 'Não encontramos resultados para “geladeira”.');
assert.ok(s.body.includes('catálogo completo'));

const home = readFileSync(join(src, 'app/home-client.tsx'), 'utf8');
assert.ok(!home.includes("searchEmptyCopy('', false).title"), 'home search empty title must use the query');
assert.ok(!/Confira o\{' '\}\s*<Link href="\/produtos">catálogo completo/.test(home), 'no duplicated catalog sentence');
assert.ok(!home.includes("searchEmptyCopy('', false).body"), 'home must not say "Volte ao início" on the home');
assert.ok(home.includes('searchEmptyCopy(q, false)'));
assert.ok(home.includes('homeEmptyCopy().title'));
assert.equal(homeEmptyCopy().title, 'Nenhum produto neste momento.');

const dep = readFileSync(join(src, 'app/departamento/[slug]/DepartamentoClient.tsx'), 'utf8');
assert.ok(!dep.includes('Nenhum produto neste departamento.'), 'department copy lives in storefront-pro');
assert.deepEqual(departmentEmptyCopy(), {
  title: 'Nenhum produto neste departamento.',
  body: 'Veja todos os produtos ou explore outro departamento.',
});

console.log('copy-centralization.spec ok');
