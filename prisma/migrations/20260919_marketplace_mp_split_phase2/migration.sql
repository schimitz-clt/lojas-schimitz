-- Marketplace MP split Phase 2 — sandbox application_fee snapshots + ledger source.
-- Additive only. Does not enable live APP_USR split. Default splitMode=off, source=manual_pix.

DO $$ BEGIN
  CREATE TYPE "PaymentSplitMode" AS ENUM ('off', 'seller_oauth_v1');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionSource" AS ENUM ('manual_pix', 'mp_application_fee');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "collectorMpUserId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "applicationFee" DECIMAL(12, 2);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "splitMode" "PaymentSplitMode" NOT NULL DEFAULT 'off';

CREATE INDEX IF NOT EXISTS "Payment_collectorMpUserId_idx" ON "Payment"("collectorMpUserId");

ALTER TABLE "CommissionLedger" ADD COLUMN IF NOT EXISTS "source" "CommissionSource" NOT NULL DEFAULT 'manual_pix';
ALTER TABLE "CommissionLedger" ADD COLUMN IF NOT EXISTS "mpPaymentId" TEXT;
ALTER TABLE "CommissionLedger" ADD COLUMN IF NOT EXISTS "mpApplicationFee" DECIMAL(12, 2);
