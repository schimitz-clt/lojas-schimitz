/**
 * Multi-step customer signup (client only).
 * Passo 1: e-mail. Passo 2: nome, CPF, nascimento, WhatsApp. Passo 3: senha e privacidade.
 * One POST /auth/register at the end: email, password, name, optional phone, CPF, birthDate.
 * Retrigger the web Railpack build after the stuck production deploy of #130.
 * CPF goes as digits or máscara; the API stores digits only.
 * birthDate is AAAA-MM-DD. Idade mínima: 18 anos (maioridade civil).
 */

export const SIGNUP_STORE_NAME = 'Lojas Schimitz';

/** Same rule as RegisterDto (`apps/api/src/modules/auth/dto.ts`). */
export const SIGNUP_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export type SignupStep = 'email' | 'profile' | 'access';

export type SignupField = 'email' | 'name' | 'cpf' | 'birthDate' | 'phone' | 'password' | 'confirm' | 'privacy';

export type SignupIssue = { field: SignupField; message: string };

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
    return { field: 'cpf', message: 'CPF inválido' };
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

/** Limites do input date: o mais novo tem 18 anos; o mais velho, 120. */
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

/** Passo 2 — dados pessoais. O e-mail já foi aceito e não entra aqui. */
export function signupProfileIssue(input: {
  name: string;
  cpf: string;
  birthDate: string;
  phone: string;
}, now: Date = new Date()): SignupIssue | null {
  if (input.name.trim().length < 2) {
    return { field: 'name', message: 'Informe seu nome completo.' };
  }
  const cpfIssue = signupCpfIssue(input.cpf);
  if (cpfIssue) return cpfIssue;
  const birthIssue = signupBirthDateIssue(input.birthDate, now);
  if (birthIssue) return birthIssue;
  if (input.phone.trim().length > 32) {
    return { field: 'phone', message: 'WhatsApp pode ter no máximo 32 caracteres.' };
  }
  return null;
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
