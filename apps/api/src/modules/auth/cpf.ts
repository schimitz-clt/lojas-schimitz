/**
 * CPF brasileiro — normaliza para 11 dígitos e confere os dígitos verificadores.
 * Rejeita sequências com todos os dígitos iguais (000…, 111…), que passam na conta
 * mas não são CPFs emitidos.
 */

export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const check = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export const CPF_INVALID_MESSAGE = 'CPF inválido. Confira os números.';

/** Mensagem em português, ou null quando o CPF pode ser gravado. */
export function cpfError(value: unknown): string | null {
  if (typeof value !== 'string') return CPF_INVALID_MESSAGE;
  const trimmed = value.trim();
  if (!trimmed) return 'Informe seu CPF.';
  if (trimmed.length > 18) return CPF_INVALID_MESSAGE;
  if (!isValidCpf(normalizeCpf(trimmed))) return CPF_INVALID_MESSAGE;
  return null;
}
