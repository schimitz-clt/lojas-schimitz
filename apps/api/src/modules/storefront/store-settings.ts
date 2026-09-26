/**
 * Optional storefront merchandising. Defaults stay in the web client.
 * Nota fiscal is refused unless a valid CNPJ is stored with the same save.
 */

export type StoreTrustItem = { title: string; body: string };

const CNPJ_WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function cnpjDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((acc, weight, i) => acc + Number(digits[i]) * weight, 0);
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

/** 14 dígitos com verificadores. Rejeita sequências repetidas. */
export function isValidCnpj(raw: string | null | undefined): boolean {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const d1 = cnpjDigit(digits, CNPJ_WEIGHTS_1);
  const d2 = cnpjDigit(digits, CNPJ_WEIGHTS_2);
  return digits.endsWith(`${d1}${d2}`);
}

export function normalizeCnpj(raw: string | null | undefined): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  return isValidCnpj(digits) ? digits : null;
}

export function parsePromoEndsAt(raw: string | null | undefined): Date | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function parsePromoLines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const row of raw) {
    if (typeof row !== 'string') continue;
    const text = row.trim().replace(/\s+/g, ' ').slice(0, 48);
    if (!text) continue;
    out.push(text);
    if (out.length >= 4) break;
  }
  return out;
}

export function parseTrustItems(raw: unknown): StoreTrustItem[] {
  if (!Array.isArray(raw)) return [];
  const out: StoreTrustItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const title = String((row as { title?: unknown }).title || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40);
    const body = String((row as { body?: unknown }).body || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 140);
    if (title.length < 2 || body.length < 2) continue;
    out.push({ title, body });
    if (out.length >= 6) break;
  }
  return out;
}

export function isNotaFiscalTrust(item: StoreTrustItem): boolean {
  return /nota\s*fiscal/i.test(`${item.title} ${item.body}`);
}

/** Drop nota fiscal when there is no valid CNPJ. */
export function trustItemsForPublic(items: StoreTrustItem[] | null, cnpj: string | null): StoreTrustItem[] | null {
  if (!items?.length) return null;
  const kept = cnpj ? items : items.filter((item) => !isNotaFiscalTrust(item));
  return kept.length ? kept : null;
}
