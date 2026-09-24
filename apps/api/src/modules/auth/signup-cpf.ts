/**
 * Passo 2 do cadastro, depois que o CPF digitado é válido.
 * A resposta pública nunca inclui o e-mail inteiro: conta nova é `{ exists: false }`;
 * conta existente é `{ exists: true, maskedEmail }` (ex.: sch***@gmail.com).
 * O login dessa conta é POST /auth/login-cpf (senha do e-mail da conta). O probe não abre sessão.
 */

export const SIGNUP_CPF_EMAIL_HIDDEN = '***@***';

export type SignupCpfCheck =
  | { exists: false }
  | { exists: true; maskedEmail: string };

/**
 * Primeiros caracteres do local + *** + domínio.
 * Local com 2+ letras nunca aparece inteiro (`ana` → `an***`, `schimitz` → `sch***`).
 */
export function maskAccountEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  const at = value.indexOf('@');
  if (at <= 0 || at !== value.lastIndexOf('@')) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!local || !domain || /\s/.test(value)) return null;
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    return null;
  }
  const visible = local.length <= 1 ? 1 : Math.min(3, local.length - 1);
  const shown = local.slice(0, visible);
  if (!shown) return null;
  const masked = `${shown}***@${domain}`;
  if (masked === value) return null;
  return masked;
}

/** `email` null/vazio = CPF livre. E-mail ilegível ainda bloqueia o cadastro, sem revelar o valor. */
export function signupCpfCheck(email: string | null | undefined): SignupCpfCheck {
  if (!email || !email.trim()) return { exists: false };
  return { exists: true, maskedEmail: maskAccountEmail(email) || SIGNUP_CPF_EMAIL_HIDDEN };
}
