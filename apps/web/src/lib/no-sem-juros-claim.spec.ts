/**
 * Guarda contra a volta da promessa "sem juros": em 09/10/2026 o Mercado Pago ofereceu 2x com 9,64% e
 * 3x com 11,23% de juros (consulta pública de parcelas), então a loja não pode anunciar parcelamento
 * sem juros. Varre código de produção (web, API, app Android) e a ficha da Play Store.
 *
 * Usos legítimos que NÃO reprovam: avisos como "juros conforme o cartão", "os juros, se houver".
 * Comentários (linhas // e *) são ignorados, para poder explicar a regra no código.
 * Para voltar a anunciar sem juros: confirme no painel do Mercado Pago, e então altere este spec.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repo = join(__dirname, '../../../..');
export const BANNED =
  /sem\s+juros|s\/\s*juros|sem\s+acr[eé]scimo|juros?\s+zero|zero\s+de\s+juros|0\s*%\s*(de\s+)?juros|interest[- ]free/i;

assert.ok(BANNED.test('Até 3x sem juros'));
assert.ok(BANNED.test('3x s/ juros'));
assert.ok(BANNED.test('parcele sem acréscimo'));
assert.ok(BANNED.test('juros zero'));
assert.ok(BANNED.test('0% de juros'));
assert.ok(!BANNED.test('Parcele em até 3x no cartão'));
assert.ok(!BANNED.test('Os juros, se houver, são definidos pelo Mercado Pago'));
assert.ok(!BANNED.test('valor base; juros conforme o cartão'));

const SKIP_DIR = new Set(['node_modules', '.next', '.e2e-dist', 'dist', 'build', '.gradle', 'uploads']);
function walk(dir: string, exts: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_DIR.has(name)) return [];
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p, exts);
    return exts.test(name) && !/\.spec\.[tj]sx?$/.test(name) && !/Test\.kt$/.test(name) ? [p] : [];
  });
}
// Único arquivo que pode citar a frase: é a regra que a bloqueia (mensagem de erro do admin).
const ALLOWED = new Set([join(repo, 'apps/api/src/common/no-interest-claim.ts')]);

function offenders(files: string[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (ALLOWED.has(f)) continue;
    readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*|<!--|#)/.test(line)) return;
        const code = line.replace(/\/\/ .*$/, '');
        if (BANNED.test(code)) out.push(`${relative(repo, f)}:${i + 1}: ${line.trim().slice(0, 140)}`);
      });
  }
  return out;
}

const files = [
  ...walk(join(repo, 'apps/web/src'), /\.(ts|tsx|css|json)$/),
  ...walk(join(repo, 'apps/web/public'), /\.(json|txt|xml|html)$/),
  ...walk(join(repo, 'apps/api/src'), /\.(ts|json)$/),
  ...walk(join(repo, 'prisma'), /\.(ts|js|sql)$/),
  ...walk(join(repo, 'apps/mobile/app/src/main'), /\.(kt|xml)$/),
  ...walk(join(repo, 'apps/mobile/store'), /\.(md|txt|xml|json)$/),
  join(repo, 'docs/omega/play-store/ficha.md'),
].filter(existsSync);
assert.ok(files.length > 100, `varredura deve cobrir o código (achou ${files.length} arquivos)`);

const bad = offenders(files);
assert.deepEqual(bad, [], `promessa de "sem juros" encontrada:\n${bad.join('\n')}`);
console.log(`no-sem-juros-claim.spec ok (${files.length} arquivos)`);
