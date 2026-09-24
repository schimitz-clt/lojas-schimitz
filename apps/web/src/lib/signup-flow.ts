/**
 * Multi-step customer signup (client only).
 * Passo 1: e-mail. CONTINUAR com formato válido consulta POST /auth/register/email-availability.
 * E-mail que já tem conta permanece no passo 1. E-mail livre segue para o passo 2.
 * Passo 2: nome, CPF, nascimento, WhatsApp. Passo 3: senha e privacidade.
 * Nome: 2+ palavras, só letras; recusa trecho cortado (`schimi`) e teclado (`asdf`).
 * CPF: dígitos verificadores (rejeita 111.111.111-11 e 034.268.570-80).
 * WhatsApp é opcional; se preenchido, precisa ser celular com DDD.
 * One POST /auth/register at the end: email, password, name, optional phone, CPF, birthDate.
 * Success is the same session as login. Duplicate CPF or e-mail is a 409 on that field.
 * Retrigger the web Railpack build after the stuck production deploy of #130.
 * CPF goes as digits or máscara; the API stores digits only.
 * birthDate na API é AAAA-MM-DD. Na tela a pessoa digita DD/MM/AAAA.
 * Idade mínima: 18 anos (maioridade civil).
 */

export const SIGNUP_STORE_NAME = 'Lojas Schimitz';

/** Same rule as RegisterDto (`apps/api/src/modules/auth/dto.ts`). */
export const SIGNUP_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export type SignupStep = 'email' | 'profile' | 'access';

export type SignupField = 'email' | 'name' | 'cpf' | 'birthDate' | 'phone' | 'password' | 'confirm' | 'privacy';

export type SignupIssue = { field: SignupField; message: string };

/** Same copy as the API (`register-public.ts`). */
export const REGISTER_CPF_EXISTS_MESSAGE =
  'Este CPF já possui conta. Entre ou use outro CPF.';

export const REGISTER_EMAIL_EXISTS_MESSAGE = 'Este e-mail já possui conta. Faça login.';

/** Passo 1. Same path as POST on the API (`auth.controller.ts`). */
export const SIGNUP_EMAIL_AVAILABILITY_PATH = '/auth/register/email-availability';

export const SIGNUP_EMAIL_CHECK_UNAVAILABLE_MESSAGE =
  'Não foi possível verificar o e-mail. Tente novamente.';

export const SIGNUP_EMAIL_CHECK_RATE_LIMIT_MESSAGE =
  'Muitas tentativas. Espere um instante e tente de novo.';

/** Same copy as the API (`cpf.ts`). */
export const SIGNUP_CPF_INVALID_MESSAGE = 'CPF inválido. Confira os números.';

export const SIGNUP_NAME_INCOMPLETE_MESSAGE = 'Informe seu nome completo.';
export const SIGNUP_NAME_SURNAME_MESSAGE = 'Informe nome e sobrenome.';
export const SIGNUP_NAME_LETTERS_MESSAGE = 'Informe nome e sobrenome, só com letras.';
export const SIGNUP_NAME_NUMBERS_MESSAGE = 'O nome não pode conter números.';
export const SIGNUP_NAME_TOO_LONG_MESSAGE = 'Nome completo pode ter no máximo 120 caracteres.';
export const SIGNUP_NAME_GIBBERISH_MESSAGE = 'O nome parece incompleto. Confira nome e sobrenome.';

/** Same copy as the API (`phone.ts`). */
export const SIGNUP_PHONE_INVALID_MESSAGE =
  'Informe um WhatsApp válido com DDD, como (51) 99999-0000.';
export const SIGNUP_PHONE_TOO_LONG_MESSAGE = 'WhatsApp pode ter no máximo 32 caracteres.';

export function signupRegisterConflict(input: {
  message?: string;
  code?: string;
}): SignupIssue | null {
  const code = (input.code || '').trim().toUpperCase();
  const message = (input.message || '').trim();
  if (code === 'CPF_ALREADY_REGISTERED' || message === REGISTER_CPF_EXISTS_MESSAGE) {
    return { field: 'cpf', message: REGISTER_CPF_EXISTS_MESSAGE };
  }
  if (code === 'EMAIL_ALREADY_REGISTERED' || message === REGISTER_EMAIL_EXISTS_MESSAGE) {
    return { field: 'email', message: REGISTER_EMAIL_EXISTS_MESSAGE };
  }
  return null;
}

export function readRegisterFailure(error: unknown): {
  conflict: SignupIssue | null;
  message: string;
} {
  const message =
    error instanceof Error && error.message ? error.message : 'Não foi possível cadastrar';
  const code =
    error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : '';
  return { conflict: signupRegisterConflict({ message, code }), message };
}

export type RegisterBody = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  cpf: string;
  birthDate: string;
};

/** Mesma régua do RegisterDto: 18 anos, teto de 120, calendário de São Paulo. */
export const MIN_SIGNUP_AGE_YEARS = 18;
export const MAX_SIGNUP_AGE_YEARS = 120;
const SIGNUP_BIRTH_TIMEZONE = 'America/Sao_Paulo';

export function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function cpfDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function formatBirthDigits(digits: string): string {
  if (digits.length <= 1) return digits;
  if (digits.length === 2) return `${digits}/`;
  if (digits.length === 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (digits.length === 4) return `${digits.slice(0, 2)}/${digits.slice(2)}/`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Máscara progressiva DD/MM/AAAA. A barra entra sozinha (08/ → 08/03/ → 08/03/1990).
 * `previous` deixa o backspace apagar o dígito quando a barra foi inserida sozinha.
 * Autofill `bday` chega como AAAA-MM-DD e vira o formato da tela.
 */
export function maskBirthDate(value: string, previous = ''): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  let digits = value.replace(/\D/g, '').slice(0, 8);
  const prevDigits = previous.replace(/\D/g, '');
  const removedAutoSlash =
    previous.endsWith('/') &&
    value.length < previous.length &&
    digits === prevDigits &&
    (prevDigits.length === 2 || prevDigits.length === 4);
  if (removedAutoSlash) digits = prevDigits.slice(0, -1);
  return formatBirthDigits(digits);
}

/** DD/MM/AAAA completo → AAAA-MM-DD. ISO já válido passa direto. Incompleto → null. */
export function birthDateToIso(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function isValidCpfDigits(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const check = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export function signupCpfIssue(cpf: string): SignupIssue | null {
  const trimmed = cpf.trim();
  if (!trimmed) return { field: 'cpf', message: 'Informe seu CPF.' };
  if (trimmed.length > 18 || !isValidCpfDigits(cpfDigits(trimmed))) {
    return { field: 'cpf', message: SIGNUP_CPF_INVALID_MESSAGE };
  }
  return null;
}

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
 * Palavra cortada ou sem cara de nome: sem vogal, letra triplicada, teclado
 * (`asdf`), ou 6+ letras com uma só vogal terminando em vogal (`schimi`).
 * Schmidt, Schimitz e Silva continuam válidos — o primeiro grupo termina em
 * consoante; Silva tem duas vogais e menos de 6 letras.
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

/**
 * Nome completo: trim, 2+ palavras, só letras (acento, hífen, apóstrofo).
 * Partículas como "da" não substituem nome e sobrenome.
 * Não consulta documento — não dá para saber se o nome é de outra pessoa.
 */
export function signupNameIssue(name: string): SignupIssue | null {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length < 5) {
    return { field: 'name', message: SIGNUP_NAME_INCOMPLETE_MESSAGE };
  }
  if (trimmed.length > 120) {
    return { field: 'name', message: SIGNUP_NAME_TOO_LONG_MESSAGE };
  }
  const words = trimmed.split(' ');
  if (words.length < 2) {
    return { field: 'name', message: SIGNUP_NAME_SURNAME_MESSAGE };
  }
  let meaningful = 0;
  for (const word of words) {
    if (/\d/.test(word)) return { field: 'name', message: SIGNUP_NAME_NUMBERS_MESSAGE };
    if (!NAME_WORD.test(word)) return { field: 'name', message: SIGNUP_NAME_LETTERS_MESSAGE };
    const letters = word.match(NAME_LETTER);
    const count = letters ? letters.length : 0;
    if (count < 2 && !NAME_PARTICLE.test(word)) {
      return { field: 'name', message: SIGNUP_NAME_LETTERS_MESSAGE };
    }
    if (nameWordIsGibberish(word)) return { field: 'name', message: SIGNUP_NAME_GIBBERISH_MESSAGE };
    if (count >= 2 && !NAME_PARTICLE.test(word)) meaningful += 1;
  }
  if (meaningful < 2) return { field: 'name', message: SIGNUP_NAME_SURNAME_MESSAGE };
  return null;
}

/** DDDs de celular (Anatel). WhatsApp do cadastro é celular, não fixo. */
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

/** Dígitos nacionais de celular (DDD + 9xxxxxxxx), ou null. */
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

/** Vazio é válido (campo opcional). Preenchido precisa ser celular com DDD. */
export function signupPhoneIssue(phone: string): SignupIssue | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (trimmed.length > 32) return { field: 'phone', message: SIGNUP_PHONE_TOO_LONG_MESSAGE };
  if (/[A-Za-z]/.test(trimmed) || !brazilianMobileDigits(trimmed)) {
    return { field: 'phone', message: SIGNUP_PHONE_INVALID_MESSAGE };
  }
  return null;
}

type CalendarDate = { y: number; m: number; d: number };

function calendarToday(now: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SIGNUP_BIRTH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { y: read('year'), m: read('month'), d: read('day') };
}

function isRealCalendarDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function completedYears(birth: CalendarDate, today: CalendarDate): number {
  let age = today.y - birth.y;
  if (today.m < birth.m || (today.m === birth.m && today.d < birth.d)) age -= 1;
  return age;
}

function isoFromParts(y: number, m: number, d: number): string {
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(d, dim);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Janela etária: o mais novo tem 18 anos; o mais velho, 120. Calendário de São Paulo. */
export function signupBirthDateBounds(now: Date = new Date()): { min: string; max: string } {
  const today = calendarToday(now);
  return {
    min: isoFromParts(today.y - MAX_SIGNUP_AGE_YEARS, today.m, today.d),
    max: isoFromParts(today.y - MIN_SIGNUP_AGE_YEARS, today.m, today.d),
  };
}

export function signupBirthDateIssue(birthDate: string, now: Date = new Date()): SignupIssue | null {
  const trimmed = birthDate.trim();
  if (!trimmed) return { field: 'birthDate', message: 'Informe a data de nascimento.' };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return { field: 'birthDate', message: 'Informe a data de nascimento no formato AAAA-MM-DD.' };
  const birth = { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  if (!isRealCalendarDate(birth.y, birth.m, birth.d)) {
    return { field: 'birthDate', message: 'Informe uma data de nascimento válida.' };
  }
  const age = completedYears(birth, calendarToday(now));
  if (age < MIN_SIGNUP_AGE_YEARS) {
    return { field: 'birthDate', message: 'É preciso ter 18 anos ou mais para criar a conta.' };
  }
  if (age > MAX_SIGNUP_AGE_YEARS) {
    return { field: 'birthDate', message: 'Informe uma data de nascimento válida.' };
  }
  return null;
}

/**
 * O que a pessoa digitou no passo 2 (DD/MM/AAAA). Data completa vira AAAA-MM-DD
 * e segue as mesmas regras de `signupBirthDateIssue`.
 */
export function signupBirthDateDisplayIssue(display: string, now: Date = new Date()): SignupIssue | null {
  const trimmed = display.trim();
  if (!trimmed) return signupBirthDateIssue('', now);
  const iso = birthDateToIso(trimmed);
  if (!iso) {
    return { field: 'birthDate', message: 'Informe a data de nascimento no formato DD/MM/AAAA.' };
  }
  return signupBirthDateIssue(iso, now);
}

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function signupEmailForApi(email: string): string {
  return email.trim().toLowerCase();
}

export function signupEmailIssue(email: string): SignupIssue | null {
  const value = email.trim();
  if (!value) return { field: 'email', message: 'Informe seu e-mail para continuar.' };
  if (value.length > 254 || value.includes('..') || !EMAIL_RE.test(value)) {
    return { field: 'email', message: 'Informe um e-mail válido.' };
  }
  return null;
}

export function continueFromEmail(
  email: string,
): { ok: true; displayEmail: string } | { ok: false; issue: SignupIssue } {
  const issue = signupEmailIssue(email);
  if (issue) return { ok: false, issue };
  return { ok: true, displayEmail: email.trim() };
}

/** Only a real `{ available: true }` from the passo 1 check may leave the e-mail step. */
export function signupEmailMayAdvance(data: { available?: unknown } | null | undefined): boolean {
  return data?.available === true;
}

/** Stay on passo 1. Duplicate e-mail uses the same copy as POST /auth/register. */
export function signupEmailCheckFailure(error: unknown): SignupIssue {
  const failure = readRegisterFailure(error);
  if (failure.conflict?.field === 'email') return failure.conflict;
  const code =
    error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code.toUpperCase()
      : '';
  if (code === 'VALIDATION_ERROR') {
    return { field: 'email', message: 'Informe um e-mail válido.' };
  }
  if (code === 'RATE_LIMITED') {
    return { field: 'email', message: SIGNUP_EMAIL_CHECK_RATE_LIMIT_MESSAGE };
  }
  return { field: 'email', message: SIGNUP_EMAIL_CHECK_UNAVAILABLE_MESSAGE };
}

/** Passo 2 — dados pessoais. O e-mail já foi aceito e não entra aqui. */
export function signupProfileIssue(input: {
  name: string;
  cpf: string;
  birthDate: string;
  phone: string;
}, now: Date = new Date()): SignupIssue | null {
  const nameIssue = signupNameIssue(input.name);
  if (nameIssue) return nameIssue;
  const cpfIssue = signupCpfIssue(input.cpf);
  if (cpfIssue) return cpfIssue;
  const birthIssue = signupBirthDateDisplayIssue(input.birthDate, now);
  if (birthIssue) return birthIssue;
  return signupPhoneIssue(input.phone);
}

/** Passo 3 — senha e aceite. Confirmação e privacidade ficam só no navegador. */
export function signupAccessIssue(input: {
  password: string;
  confirmPassword: string;
  acceptedPrivacy: boolean;
}): SignupIssue | null {
  if (input.password.length < 8) {
    return { field: 'password', message: 'A senha precisa ter no mínimo 8 caracteres.' };
  }
  if (!SIGNUP_PASSWORD_PATTERN.test(input.password)) {
    return { field: 'password', message: 'Senha deve ter letras e números' };
  }
  if (!input.confirmPassword) {
    return { field: 'confirm', message: 'Confirme a senha.' };
  }
  if (input.password !== input.confirmPassword) {
    return { field: 'confirm', message: 'As senhas não conferem.' };
  }
  if (!input.acceptedPrivacy) {
    return { field: 'privacy', message: 'Aceite a Política de Privacidade para continuar.' };
  }
  return null;
}

export function signupDetailsIssue(input: {
  email: string;
  name: string;
  cpf: string;
  birthDate: string;
  phone: string;
  password: string;
  confirmPassword: string;
  acceptedPrivacy: boolean;
}, now: Date = new Date()): SignupIssue | null {
  const emailIssue = signupEmailIssue(input.email);
  if (emailIssue) return emailIssue;
  const profileIssue = signupProfileIssue(input, now);
  if (profileIssue) return profileIssue;
  return signupAccessIssue(input);
}

/** Payload for POST /auth/register. Confirm-password and privacy stay on the client. */
export function buildRegisterBody(input: {
  email: string;
  name: string;
  cpf: string;
  birthDate: string;
  phone: string;
  password: string;
}): RegisterBody {
  const phone = input.phone.trim();
  const body: RegisterBody = {
    name: input.name.trim(),
    email: signupEmailForApi(input.email),
    password: input.password,
    cpf: cpfDigits(input.cpf),
    birthDate: input.birthDate.trim(),
  };
  if (phone) body.phone = phone;
  return body;
}
