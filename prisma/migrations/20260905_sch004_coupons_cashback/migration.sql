-- SCH-004 — Cupons admin + SCHIMITZ+ cashback (aditiva). NÃO edita migrations históricas.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cashbackBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cashbackUsed" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "CashbackLedger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT,
  "kind" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "balanceAfter" DECIMAL(12,2) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashbackLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CashbackLedger_orderId_kind_key"
  ON "CashbackLedger"("orderId", "kind");

CREATE INDEX IF NOT EXISTS "CashbackLedger_userId_idx" ON "CashbackLedger"("userId");
CREATE INDEX IF NOT EXISTS "CashbackLedger_createdAt_idx" ON "CashbackLedger"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CashbackLedger_userId_fkey'
  ) THEN
    ALTER TABLE "CashbackLedger"
      ADD CONSTRAINT "CashbackLedger_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CashbackLedger_orderId_fkey'
  ) THEN
    ALTER TABLE "CashbackLedger"
      ADD CONSTRAINT "CashbackLedger_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
