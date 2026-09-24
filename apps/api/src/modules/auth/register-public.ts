/**
 * Public register conflicts.
 * A new account receives the same session as login (cookie + tokens).
 * An existing CPF or e-mail is a 409 with a clear Portuguese message.
 * Invalid CPF and under-18 stay 400 in AuthService — not a conflict.
 * When both identifiers are taken, CPF wins so the store can point at that field.
 */

export const REGISTER_CPF_EXISTS_MESSAGE =
  'Este CPF já possui conta. Entre ou use outro CPF.';

export const REGISTER_EMAIL_EXISTS_MESSAGE =
  'Este e-mail já possui conta. Faça login.';

export const REGISTER_CPF_EXISTS_CODE = 'CPF_ALREADY_REGISTERED';
export const REGISTER_EMAIL_EXISTS_CODE = 'EMAIL_ALREADY_REGISTERED';

export type RegisterDuplicateConflict = {
  message: string;
  code: string;
  field: 'cpf' | 'email';
};

export function registerDuplicateConflict(taken: {
  email: boolean;
  cpf: boolean;
}): RegisterDuplicateConflict | null {
  if (taken.cpf) {
    return {
      message: REGISTER_CPF_EXISTS_MESSAGE,
      code: REGISTER_CPF_EXISTS_CODE,
      field: 'cpf',
    };
  }
  if (taken.email) {
    return {
      message: REGISTER_EMAIL_EXISTS_MESSAGE,
      code: REGISTER_EMAIL_EXISTS_CODE,
      field: 'email',
    };
  }
  return null;
}
