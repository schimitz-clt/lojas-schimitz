/**
 * Cadastro público: conta nova abre sessão (igual ao login).
 * E-mail ou CPF já usado responde 409 com mensagem distinta.
 * CPF inválido e menor de 18 anos continuam 400 no DTO / AuthService.
 * Esqueci a senha segue genérico (anti-enumeração) — isso não vale para o cadastro.
 */

import { ConflictException } from '@nestjs/common';

export const EMAIL_ALREADY_REGISTERED_MESSAGE = 'Este e-mail já possui conta. Faça login.';

export const CPF_ALREADY_REGISTERED_MESSAGE =
  'Este CPF já possui conta. Entre ou use outro CPF.';

export const EMAIL_ALREADY_REGISTERED_CODE = 'EMAIL_ALREADY_REGISTERED';
export const CPF_ALREADY_REGISTERED_CODE = 'CPF_ALREADY_REGISTERED';

export function emailAlreadyRegistered(): never {
  throw new ConflictException({
    message: EMAIL_ALREADY_REGISTERED_MESSAGE,
    code: EMAIL_ALREADY_REGISTERED_CODE,
  });
}

export function cpfAlreadyRegistered(): never {
  throw new ConflictException({
    message: CPF_ALREADY_REGISTERED_MESSAGE,
    code: CPF_ALREADY_REGISTERED_CODE,
  });
}

/** E-mail tem precedência quando os dois já existem. Nenhum dos dois: segue o create. */
export function assertRegisterAvailable(emailTaken: boolean, cpfTaken: boolean): void {
  if (emailTaken) emailAlreadyRegistered();
  if (cpfTaken) cpfAlreadyRegistered();
}

/** Corrida no unique (P2002). Alvo com "cpf" é CPF; o resto do User unique é e-mail. */
export function conflictFromUniqueTarget(target: unknown): never {
  const raw = Array.isArray(target) ? target.map(String).join(',') : String(target ?? '');
  if (raw.toLowerCase().includes('cpf')) cpfAlreadyRegistered();
  emailAlreadyRegistered();
}
