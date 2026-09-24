/**
 * Nome completo do cadastro.
 * Exige pelo menos duas palavras com letras (partículas como "da" não contam
 * como nome e sobrenome). Não consulta documento — só recusa vazio, uma palavra,
 * dígitos e símbolos.
 */

export const FULL_NAME_INCOMPLETE_MESSAGE = 'Informe seu nome completo.';
export const FULL_NAME_SURNAME_MESSAGE = 'Informe nome e sobrenome.';
export const FULL_NAME_LETTERS_MESSAGE = 'Informe nome e sobrenome, só com letras.';
export const FULL_NAME_NUMBERS_MESSAGE = 'O nome não pode conter números.';
export const FULL_NAME_TOO_LONG_MESSAGE = 'Nome completo pode ter no máximo 120 caracteres.';

const NAME_LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ]/g;
const NAME_WORD = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’.-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
const NAME_PARTICLE = /^(da|de|do|das|dos|e|di|du|del|van|von|y|la|le|mc)$/i;

/** Mensagem em português, ou null quando o nome pode ser gravado. */
export function fullNameError(value: unknown): string | null {
  if (typeof value !== 'string') return FULL_NAME_INCOMPLETE_MESSAGE;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length < 5) return FULL_NAME_INCOMPLETE_MESSAGE;
  if (trimmed.length > 120) return FULL_NAME_TOO_LONG_MESSAGE;
  const words = trimmed.split(' ');
  if (words.length < 2) return FULL_NAME_SURNAME_MESSAGE;
  let meaningful = 0;
  for (const word of words) {
    if (/\d/.test(word)) return FULL_NAME_NUMBERS_MESSAGE;
    if (!NAME_WORD.test(word)) return FULL_NAME_LETTERS_MESSAGE;
    const letters = word.match(NAME_LETTER);
    const count = letters ? letters.length : 0;
    if (count < 2 && !NAME_PARTICLE.test(word)) return FULL_NAME_LETTERS_MESSAGE;
    if (count >= 2 && !NAME_PARTICLE.test(word)) meaningful += 1;
  }
  if (meaningful < 2) return FULL_NAME_SURNAME_MESSAGE;
  return null;
}
