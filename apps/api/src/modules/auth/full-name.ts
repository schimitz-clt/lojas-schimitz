/**
 * Nome completo do cadastro.
 * Exige pelo menos duas palavras com letras (acento, hífen, apóstrofo).
 * Partículas como "da" não substituem nome e sobrenome.
 * Recusa trecho cortado ou teclado (`schimi`, `asdf`) sem consultar documento.
 */

export const FULL_NAME_INCOMPLETE_MESSAGE = 'Informe seu nome completo.';
export const FULL_NAME_SURNAME_MESSAGE = 'Informe nome e sobrenome.';
export const FULL_NAME_LETTERS_MESSAGE = 'Informe nome e sobrenome, só com letras.';
export const FULL_NAME_NUMBERS_MESSAGE = 'O nome não pode conter números.';
export const FULL_NAME_TOO_LONG_MESSAGE = 'Nome completo pode ter no máximo 120 caracteres.';
export const FULL_NAME_GIBBERISH_MESSAGE = 'O nome parece incompleto. Confira nome e sobrenome.';

const NAME_LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ]/g;
const NAME_WORD = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’.-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
const NAME_PARTICLE = /^(da|de|do|das|dos|e|di|du|del|van|von|y|la|le|mc)$/i;
const NAME_VOWEL = /[aeiouyáàâãäéèêëíìîïóòôõöúùûüýÿ]/i;
const NAME_PLACEHOLDER =
  /^(asdf+|qwerty?|zxcv+|teste?|nome|sobrenome|fulano|beltrano|sicrano|abcd+|xxx+|aaa+)$/i;

function foldNameLetters(word: string): string {
  return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Palavra cortada ou sem cara de nome. Schmidt/Schimitz terminam em consoante
 * e entram; "schimi" (uma vogal, acaba em vogal, 6 letras) não.
 */
function nameWordIsGibberish(word: string): boolean {
  if (NAME_PARTICLE.test(word)) return false;
  if (!NAME_VOWEL.test(word)) return true;
  const folded = foldNameLetters(word);
  if (/(.)\1\1/.test(folded)) return true;
  if (NAME_PLACEHOLDER.test(folded)) return true;
  const vowels = new Set(folded.match(/[aeiouy]/g) || []);
  return folded.length >= 6 && vowels.size < 2 && /[aeiouy]$/.test(folded);
}

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
    if (nameWordIsGibberish(word)) return FULL_NAME_GIBBERISH_MESSAGE;
    if (count >= 2 && !NAME_PARTICLE.test(word)) meaningful += 1;
  }
  if (meaningful < 2) return FULL_NAME_SURNAME_MESSAGE;
  return null;
}
