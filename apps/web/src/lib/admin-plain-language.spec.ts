/** Admin para dono de loja: nenhuma rota técnica (GET /admin/...) nos textos visíveis. */
import assert from 'assert';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const EP = /\b(GET|POST|PATCH|PUT|DELETE)(\/(GET|POST|PATCH|PUT|DELETE))*\s+\/[\w/]/;
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = [
  ...walk(join(__dirname, '../components/admin')).filter((f) => /\.(tsx?|ts)$/.test(f)),
  ...readdirSync(__dirname).filter((n) => n.startsWith('admin') && n.endsWith('.ts') && !n.endsWith('.spec.ts')).map((n) => join(__dirname, n)),
];
const bad: string[] = [];
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    if (EP.test(line)) bad.push(`${f.split('/src/')[1]}:${i + 1}: ${t.slice(0, 100)}`);
  });
}
assert.deepEqual(bad, [], `rota técnica em texto do admin:\n${bad.join('\n')}`);
console.log(`admin-plain-language: PASSOU (${files.length} arquivos)`);
