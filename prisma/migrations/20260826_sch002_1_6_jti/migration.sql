-- SCH-002.1 Fase C — jti no refresh token
-- Não reescreve migrations históricas.

ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "jti" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_jti_key" ON "RefreshToken"("jti");
