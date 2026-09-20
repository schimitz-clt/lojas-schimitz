-- Additive: lista de desejos (Salvos) — índice de listagem por usuário + recência.
-- A tabela "Favorite" já existia (SCH-001). Sem DROP / sem coluna nova.

CREATE INDEX IF NOT EXISTS "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt");
