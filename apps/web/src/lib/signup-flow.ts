/**
 * Multi-step customer signup — UI state only.
 * The final POST is still RegisterDto: email, password, name, optional phone.
 * CPF / birth date are not part of the public register contract.
 */

export const SIGNUP_STORE_NAME = 'Lojas Schimitz';

/** Same rule as RegisterDto (`apps/api/src/modules/auth/dto.ts`). */
export const SIGNUP_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export type SignupStep = 'email' | 'details';

export type SignupField = 'email' | 'name' | 'phone' | 'password' | 'confirm' | 'privacy';

export type SignupIssue = { field: SignupField; message: string };

export type RegisterBody = {
  name: string;
  email: string;
  password: string;
  phone?: string;
};

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

export function signupDetailsIssue(input: {
  email: string;
  name: string;
  phone: string;
  password: string;
  confirmPassword: string;
  acceptedPrivacy: boolean;
}): SignupIssue | null {
  const emailIssue = signupEmailIssue(input.email);
  if (emailIssue) return emailIssue;
  if (input.name.trim().length < 2) {
    return { field: 'name', message: 'Informe seu nome completo.' };
  }
  if (input.phone.trim().length > 32) {
    return { field: 'phone', message: 'WhatsApp pode ter no máximo 32 caracteres.' };
  }
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

/** Payload for POST /auth/register. Confirm-password and privacy stay on the client. */
export function buildRegisterBody(input: {
  email: string;
  name: string;
  phone: string;
  password: string;
}): RegisterBody {
  const phone = input.phone.trim();
  const body: RegisterBody = {
    name: input.name.trim(),
    email: signupEmailForApi(input.email),
    password: input.password,
  };
  if (phone) body.phone = phone;
  return body;
}
