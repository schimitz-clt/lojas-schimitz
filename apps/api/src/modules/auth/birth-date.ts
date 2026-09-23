/**
 * Data de nascimento do cadastro.
 * Idade mínima: 18 anos (maioridade civil — Código Civil art. 5º).
 * A loja não tinha outra regra de idade; 18 acompanha o cadastro de referência
 * e a capacidade civil para contratar.
 * Idade máxima: 120 anos, para recusar ano digitado errado.
 * "Hoje" é o calendário de America/Sao_Paulo.
 */

export const MIN_SIGNUP_AGE_YEARS = 18;
export const MAX_SIGNUP_AGE_YEARS = 120;
export const SIGNUP_BIRTH_TIMEZONE = 'America/Sao_Paulo';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type CalendarDate = { y: number; m: number; d: number };

export function calendarDateInTimeZone(
  now: Date,
  timeZone: string = SIGNUP_BIRTH_TIMEZONE,
): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { y: read('year'), m: read('month'), d: read('day') };
}

export function isRealCalendarDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Idade inteira em anos completos. O aniversário ainda não ocorrido não conta. */
export function completedYears(birth: CalendarDate, today: CalendarDate): number {
  let age = today.y - birth.y;
  if (today.m < birth.m || (today.m === birth.m && today.d < birth.d)) age -= 1;
  return age;
}

export function parseIsoDate(value: string): CalendarDate | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!isRealCalendarDate(y, m, d)) return null;
  return { y, m, d };
}

/** Mensagem em português, ou null quando a data pode ser gravada. */
export function birthDateError(value: unknown, now: Date = new Date()): string | null {
  if (typeof value !== 'string' || !value.trim()) return 'Informe a data de nascimento.';
  const trimmed = value.trim();
  if (!ISO_DATE.test(trimmed)) return 'Informe a data de nascimento no formato AAAA-MM-DD.';
  const birth = parseIsoDate(trimmed);
  if (!birth) return 'Informe uma data de nascimento válida.';
  const age = completedYears(birth, calendarDateInTimeZone(now));
  if (age < MIN_SIGNUP_AGE_YEARS) return 'É preciso ter 18 anos ou mais para criar a conta.';
  if (age > MAX_SIGNUP_AGE_YEARS) return 'Informe uma data de nascimento válida.';
  return null;
}

/** Meia-noite UTC do dia civil, para coluna DATE (sem deslocar o calendário). */
export function birthDateToUtcDate(iso: string): Date {
  const birth = parseIsoDate(iso.trim());
  if (!birth) throw new Error('birthDate inválida');
  return new Date(Date.UTC(birth.y, birth.m - 1, birth.d));
}
