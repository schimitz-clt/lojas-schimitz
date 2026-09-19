-- Marketplace MP split Phase 1 — Seller OAuth fields + encrypted credentials.
-- Additive only. Does not move money. createIntent must NOT send application_fee.

DO $$ BEGIN
  CREATE TYPE "SellerMpOAuthStatus" AS ENUM ('pending', 'linked', 'expired', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "mpUserId" TEXT;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "mpPublicKey" TEXT;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "mpOAuthStatus" "SellerMpOAuthStatus" NOT NULL DEFAULT 'pending';
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "mpTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Seller_mpUserId_key" ON "Seller"("mpUserId");
CREATE INDEX IF NOT EXISTS "Seller_mpOAuthStatus_idx" ON "Seller"("mpOAuthStatus");

CREATE TABLE IF NOT EXISTS "SellerMpCredential" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "accessTokenEnc" TEXT NOT NULL,
  "refreshTokenEnc" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerMpCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SellerMpCredential_sellerId_key" ON "SellerMpCredential"("sellerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerMpCredential_sellerId_fkey'
  ) THEN
    ALTER TABLE "SellerMpCredential"
      ADD CONSTRAINT "SellerMpCredential_sellerId_fkey"
      FOREIGN KEY ("sellerId") REFERENCES "Seller"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
