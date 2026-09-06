-- SCH-008 Marketplace v1 — Seller + product/orderItem sellerId (safe backfill).

-- 1) Enum
DO $$ BEGIN
  CREATE TYPE "SellerStatus" AS ENUM ('pending', 'active', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Seller table
CREATE TABLE IF NOT EXISTS "Seller" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "SellerStatus" NOT NULL DEFAULT 'pending',
  "ownerUserId" TEXT,
  "commissionPercent" DECIMAL(5,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Seller_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Seller_slug_key" ON "Seller"("slug");
CREATE INDEX IF NOT EXISTS "Seller_status_idx" ON "Seller"("status");
CREATE INDEX IF NOT EXISTS "Seller_ownerUserId_idx" ON "Seller"("ownerUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Seller_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "Seller"
      ADD CONSTRAINT "Seller_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) Default storefront seller (deterministic id for ops)
INSERT INTO "Seller" ("id", "name", "slug", "status", "ownerUserId", "commissionPercent", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Lojas Schimitz',
  'lojas-schimitz',
  'active',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "status" = 'active',
  "updatedAt" = CURRENT_TIMESTAMP;

-- 4) Product.sellerId — add nullable, backfill, set NOT NULL
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sellerId" TEXT;

UPDATE "Product"
SET "sellerId" = (
  SELECT s."id" FROM "Seller" s WHERE s."slug" = 'lojas-schimitz' LIMIT 1
)
WHERE "sellerId" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "sellerId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Product_sellerId_idx" ON "Product"("sellerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Product_sellerId_fkey'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_sellerId_fkey"
      FOREIGN KEY ("sellerId") REFERENCES "Seller"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 5) OrderItem.sellerId snapshot (nullable for historical rows)
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "sellerId" TEXT;

CREATE INDEX IF NOT EXISTS "OrderItem_sellerId_idx" ON "OrderItem"("sellerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_sellerId_fkey'
  ) THEN
    ALTER TABLE "OrderItem"
      ADD CONSTRAINT "OrderItem_sellerId_fkey"
      FOREIGN KEY ("sellerId") REFERENCES "Seller"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill existing order items from current product seller (best-effort snapshot)
UPDATE "OrderItem" oi
SET "sellerId" = p."sellerId"
FROM "Product" p
WHERE oi."productId" = p."id"
  AND oi."sellerId" IS NULL;
