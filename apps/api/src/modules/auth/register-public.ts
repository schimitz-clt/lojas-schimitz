/**
 * Public register response — same shape for new and already-registered e-mails
 * (anti-enumeration). Timing is equalized in AuthService by always hashing first.
 */

export const REGISTER_ACCEPTED_MESSAGE =
  'Se o e-mail ainda não estiver cadastrado, sua conta foi criada. Faça login para continuar.';

export type RegisterAccepted = {
  accepted: true;
  message: string;
};

export function registerAcceptedResult(): RegisterAccepted {
  return { accepted: true, message: REGISTER_ACCEPTED_MESSAGE };
}
