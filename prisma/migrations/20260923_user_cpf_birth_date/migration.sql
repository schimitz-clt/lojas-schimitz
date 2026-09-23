-- Cadastro: CPF e data de nascimento.
-- Aditivo: contas já existentes ficam com NULL. Não apaga linhas nem reescreve e-mail/senha.
-- CPF único só quando preenchido (PostgreSQL permite vários NULL no índice único).
-- Novos cadastros enviam os dois campos em POST /auth/register.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cpf" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birthDate" DATE;

CREATE UNIQUE INDEX IF NOT EXISTS "User_cpf_key" ON "User"("cpf");
