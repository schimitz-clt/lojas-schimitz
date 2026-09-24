/**
 * WhatsApp opcional do cadastro: celular brasileiro com DDD.
 * Aceita máscara, dígitos e DDI 55. Vazio continua opcional.
 */

export const PHONE_INVALID_MESSAGE =
  'Informe um WhatsApp válido com DDD, como (51) 99999-0000.';
export const PHONE_TOO_LONG_MESSAGE = 'WhatsApp pode ter no máximo 32 caracteres.';

/** DDDs de celular (Anatel). */
const BR_MOBILE_DDD = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

/** 11 dígitos nacionais (DDD + 9xxxxxxxx), ou null. */
export function brazilianMobileDigits(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length === 13) digits = digits.slice(2);
  if (!/^\d{11}$/.test(digits)) return null;
  if (/^(\d)\1{10}$/.test(digits)) return null;
  const ddd = digits.slice(0, 2);
  const local = digits.slice(2);
  if (!BR_MOBILE_DDD.has(ddd) || !/^9\d{8}$/.test(local)) return null;
  return digits;
}

/** null quando o telefone pode ser gravado (inclusive ausente). */
export function phoneError(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return PHONE_INVALID_MESSAGE;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 32) return PHONE_TOO_LONG_MESSAGE;
  if (/[A-Za-z]/.test(trimmed) || !brazilianMobileDigits(trimmed)) return PHONE_INVALID_MESSAGE;
  return null;
}
