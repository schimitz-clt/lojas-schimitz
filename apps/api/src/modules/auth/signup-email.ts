/**
 * Passo 1 do cadastro. The server says whether the e-mail already has a user row.
 * The public body is only `{ exists }` — no name, CPF, phone, birth date, or id.
 */

export type SignupEmailCheck = { exists: boolean };

export function signupEmailCheck(found: boolean): SignupEmailCheck {
  return { exists: found };
}
