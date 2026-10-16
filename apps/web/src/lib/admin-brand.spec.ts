/** Admin usa a marca da loja: azul-marinho e vinho (sem o amarelo/preto antigo). */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';

const css = readFileSync(join(__dirname, '../components/admin/admin-theme.css'), 'utf8');
const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
assert.ok(root.includes('--admin-accent: #8c2438'), 'destaque vinho');
assert.ok(root.includes('--admin-dark: #07122a'), 'superfície marinho');
assert.ok(!/#f5c400/i.test(css), 'sem amarelo antigo');
assert.ok(/\.admin-header,[\s\S]*?--admin-accent: #f0b3c0/.test(css), 'destaque claro sobre marinho');

// contraste: vinho #8c2438 sobre creme #fffcf7 e rosa #f0b3c0 sobre marinho #07122a ≥ 4.5
function lum(hex: string) {
  const c = hex.match(/[0-9a-f]{2}/gi)!.map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
assert.ok(ratio('8c2438', 'fffcf7') >= 4.5, 'vinho/creme AA');
assert.ok(ratio('f0b3c0', '07122a') >= 4.5, 'rosa/marinho AA');
assert.ok(ratio('ffffff', '8c2438') >= 4.5, 'branco/vinho AA');
const manifest = JSON.parse(readFileSync(join(__dirname, '../../public/admin/manifest.webmanifest'), 'utf8'));
assert.equal(manifest.theme_color, '#07122a');
console.log('admin-brand: PASSOU');
