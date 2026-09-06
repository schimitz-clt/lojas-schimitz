-- SCH-010 Commission payouts foundation (Repasse v1): approved status + payout metadata.
-- Real money transfer remains manual PIX; no Mercado Pago marketplace split.

-- 1) Add approved to CommissionStatus (idempotent; append-only in PostgreSQL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'CommissionStatus'
      AND e.enumlabel = 'approved'
  ) THEN
    ALTER TYPE "CommissionStatus" ADD VALUE 'approved';
  END IF;
END $$;

-- 2) Payout metadata on CommissionLedger
ALTER TABLE "CommissionLedger"
  ADD COLUMN IF NOT EXISTS "payoutReference" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "payoutNote" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
