/**
 * Formatação pt-BR de preços sem Intl no caminho comum.
 *
 * A 1ª chamada a qualquer formatação `pt-BR` (`toLocaleString`/`Intl.NumberFormat`) carrega
 * os dados de locale do ICU: ~40 ms de main thread num Android médio (CPU 4×), bem no meio
 * da hidratação de home, catálogo e PDP — e cada `toLocaleString` ainda monta um formatter
 * novo (~8 ms a cada 100 preços). Aqui o caso comum (número finito, < 1e15, sem notação
 * exponencial) é montado à mão com a MESMA saída do Intl:
 *   - arredondamento "half-expand" sobre a representação decimal mais curta (`String(n)`),
 *     como o ICU faz (1.005 → 1,01; 2.675 → 2,68);
 *   - milhar com ".", decimal com ",", "R$" + NBSP (U+00A0), negativo como "-R$ …"
 *     (inclusive -0 e valores que arredondam para 0).
 * Qualquer outra coisa (NaN, ±Infinity, exponencial) cai no Intl, sem mudança de saída.
 * money-format.spec.ts compara com o Intl em centenas de milhares de valores.
 */
const NBSP = '\u00a0';

let intlBrl: Intl.NumberFormat | null = null;
let intlBrlWhole: Intl.NumberFormat | null = null;
let intlTwo: Intl.NumberFormat | null = null;
let intlInt: Intl.NumberFormat | null = null;

function group(intDigits: string): string {
  let out = '';
  for (let i = intDigits.length; i > 0; i -= 3) {
    const start = Math.max(0, i - 3);
    out = intDigits.slice(start, i) + (out ? '.' + out : '');
  }
  return out;
}

/** Arredonda |n| para `digits` casas (half-expand na forma decimal curta) → [inteiro, fração] ou null se exótico. */
function fixedParts(n: number, digits: number): [string, string] | null {
  if (!Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  if (abs >= 1e15) return null;
  const s = String(abs);
  if (s.includes('e')) {
    // Exponencial só aparece aqui para |n| < 1e-6: arredonda para zero com qualquer `digits` ≤ 2.
    if (abs < 1e-6 && digits <= 2) return ['0', '0'.repeat(digits)];
    return null;
  }
  const dot = s.indexOf('.');
  let int = dot < 0 ? s : s.slice(0, dot);
  let frac = dot < 0 ? '' : s.slice(dot + 1);
  if (frac.length > digits) {
    const roundUp = frac.charCodeAt(digits) >= 53; /* '5' */
    frac = frac.slice(0, digits);
    if (roundUp) {
      // Soma 1 na última casa mantida, propagando o "vai um".
      const all = (int + frac).split('');
      let i = all.length - 1;
      while (i >= 0) {
        if (all[i] === '9') {
          all[i] = '0';
          i--;
        } else {
          all[i] = String.fromCharCode(all[i].charCodeAt(0) + 1);
          break;
        }
      }
      let joined = all.join('');
      if (i < 0) joined = '1' + joined;
      int = joined.slice(0, joined.length - digits) || '0';
      frac = digits ? joined.slice(joined.length - digits) : '';
    }
  }
  while (frac.length < digits) frac += '0';
  return [int, frac];
}

function negative(n: number): boolean {
  return n < 0 || Object.is(n, -0);
}

/** R$ 1.234,56 — mesma saída de `Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`. */
export function formatBrlCurrency(value: number | string): string {
  const n = Number(value);
  const p = fixedParts(n, 2);
  if (!p) return (intlBrl ??= new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })).format(n);
  return `${negative(n) ? '-' : ''}R$${NBSP}${group(p[0])},${p[1]}`;
}

/** R$ 1.235 — mesma saída de `n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })`. */
export function formatBrlCurrencyWhole(n: number): string {
  const p = fixedParts(n, 0);
  if (!p) return (intlBrlWhole ??= new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })).format(n);
  return `${negative(n) ? '-' : ''}R$${NBSP}${group(p[0])}`;
}

/** 1.234,56 — mesma saída de `n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`. */
export function formatTwoDecimals(n: number): string {
  const p = fixedParts(n, 2);
  if (!p) return (intlTwo ??= new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })).format(n);
  return `${negative(n) ? '-' : ''}${group(p[0])},${p[1]}`;
}

/** 1.234 — mesma saída de `n.toLocaleString('pt-BR')` para inteiros (contagens). */
export function formatCount(n: number): string {
  if (!Number.isSafeInteger(n)) return (intlInt ??= new Intl.NumberFormat('pt-BR')).format(n);
  return `${negative(n) ? '-' : ''}${group(String(Math.abs(n)))}`;
}
