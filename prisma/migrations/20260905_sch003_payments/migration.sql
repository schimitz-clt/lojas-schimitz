-- SCH-003 — Pagamentos (aditiva). NÃO edita migrations históricas.

-- 1) Novos valores no enum PaymentStatus
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'cancelled';

-- 2) Coluna payload no Payment (QR PIX / dados do provedor)
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "payload" JSONB;

-- 3) Unique parcial: no máximo 1 Payment pending por orderId
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_one_pending_per_order"
  ON "Payment"("orderId")
  WHERE "status" = 'pending';

-- 4) Tabela PaymentEvent (idempotência de webhook)
CREATE TABLE IF NOT EXISTS "PaymentEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "paymentId" TEXT,
  "topic" TEXT,
  "payload" JSONB,
  "applied" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentEvent_provider_providerEventId_key"
  ON "PaymentEvent"("provider", "providerEventId");

CREATE INDEX IF NOT EXISTS "PaymentEvent_paymentId_idx" ON "PaymentEvent"("paymentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentEvent_paymentId_fkey'
  ) THEN
    ALTER TABLE "PaymentEvent"
      ADD CONSTRAINT "PaymentEvent_paymentId_fkey"
      FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
