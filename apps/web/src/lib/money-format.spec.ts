/**
 * money-format: saída idêntica ao Intl pt-BR (o que toLocaleString produzia antes),
 * em bordas e em centenas de milhares de valores de preço realistas e aleatórios.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatBrlCurrency, formatBrlCurrencyWhole, formatCount, formatTwoDecimals } from './money-format';
import { brl } from './api';
import { formatBRL } from './whatsapp';
import { splitBrl } from './identidade';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const WHOLE = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const TWO = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const INT = new Intl.NumberFormat('pt-BR');

assert.equal(BRL.format(1234.5), 'R$\u00a01.234,50', 'ICU do runtime em pt-BR padrão');

const edges: Array<number | string> = [
  0, -0, 1, -1, 0.5, 0.004, 0.005, 0.0049999, -0.004, -0.005, 1e-7, -1e-7, 5e-7, 1.005, 2.675, 1.015, 0.125, 10.235,
  9.995, 99.995, 999.995, 9999.995, 99999.995, 999999.995, 0.995, 19.999, 129.9, 1999, 12345.678, 1e7, 123456789.125,
  999999999999999, 999999999999999.9, 1e15, 1e16, 1e21, -5, -1234.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER,
  Number.MIN_VALUE, Number.EPSILON, '89.90', '1.5', ' 12 ', '', 'abc', '1e3', '-0', '0x10',
];
const check = (v: number | string) => {
  const n = Number(v);
  assert.equal(formatBrlCurrency(v), BRL.format(n), `BRL ${String(v)}`);
  assert.equal(formatBrlCurrencyWhole(n), WHOLE.format(n), `inteiro ${String(v)}`);
  assert.equal(formatTwoDecimals(n), TWO.format(n), `2 casas ${String(v)}`);
  assert.equal(formatCount(n), INT.format(n), `contagem ${String(v)}`);
};
edges.forEach(check);

// Preços reais da loja: centavos, PIX −5% / −10%, parcelas /2../12, frete somado, quantidade × preço.
for (let cents = 0; cents <= 300000; cents += 7) {
  const p = cents / 100;
  for (const v of [p, p * 0.95, p * 0.9, p / 3, p / 10, p / 12, p * 3, p + 19.9, -p]) check(v);
}
// Aleatórios em várias escalas (seed fixo → reprodutível).
let seed = 20261018;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let i = 0; i < 200000; i++) {
  const scale = 10 ** Math.floor(rnd() * 16 - 3);
  check((rnd() - 0.1) * scale);
}
for (let i = -2000; i <= 2_000_000; i += 997) check(i);

// Os helpers públicos que a vitrine usa continuam com a mesma saída.
for (const v of [0, 129.9, '89.90', 1234.567, -3]) {
  assert.equal(brl(v), Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  assert.equal(formatBRL(v), Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
}
assert.deepEqual(splitBrl(1234.5), { whole: '1.234', cents: ',50' });
assert.deepEqual(splitBrl(-3), { whole: '0', cents: ',00' });
assert.deepEqual(splitBrl(0.995), { whole: '1', cents: ',00' });

// Vitrine sem Intl no caminho comum (o custo é a 1ª carga do ICU na hidratação).
const lib = (p: string) => readFileSync(join(__dirname, p), 'utf8');
for (const f of ['api.ts', 'whatsapp.ts', 'identidade.ts', 'wishlist-ui.ts', 'product-compare.ts', 'search-suggestions.ts', 'storefront-pro.ts', 'pdp-share.ts']) {
  assert.ok(!/toLocaleString\(\s*'pt-BR'/.test(lib(f)), `${f} usa money-format, não toLocaleString`);
}
console.log('money-format.spec OK');
