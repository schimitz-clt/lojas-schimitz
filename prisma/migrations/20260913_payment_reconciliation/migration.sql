-- Payment integrity: durable RECONCILIATION_REQUIRED for authenticated orphan webhooks.
-- Generate only — do NOT run against production from this change set.

CREATE TABLE IF NOT EXISTS "PaymentReconciliation" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "externalReference" TEXT,
  "providerStatus" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECONCILIATION_REQUIRED',
  "paymentEventId" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentReconciliation_provider_externalId_key"
  ON "PaymentReconciliation"("provider", "externalId");

CREATE INDEX IF NOT EXISTS "PaymentReconciliation_status_createdAt_idx"
  ON "PaymentReconciliation"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "PaymentReconciliation_paymentEventId_idx"
  ON "PaymentReconciliation"("paymentEventId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentReconciliation_paymentEventId_fkey'
  ) THEN
    ALTER TABLE "PaymentReconciliation"
      ADD CONSTRAINT "PaymentReconciliation_paymentEventId_fkey"
      FOREIGN KEY ("paymentEventId") REFERENCES "PaymentEvent"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
