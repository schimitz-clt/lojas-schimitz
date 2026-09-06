-- SCH-009 Seller portal + commission stub + catalog stock/image fix (idempotent).

-- 1) CommissionStatus enum
DO $$ BEGIN
  CREATE TYPE "CommissionStatus" AS ENUM ('pending', 'paid', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) CommissionLedger
CREATE TABLE IF NOT EXISTS "CommissionLedger" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "percent" DECIMAL(5,2) NOT NULL,
  "status" "CommissionStatus" NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommissionLedger_orderItemId_key" ON "CommissionLedger"("orderItemId");
CREATE INDEX IF NOT EXISTS "CommissionLedger_sellerId_status_idx" ON "CommissionLedger"("sellerId", "status");
CREATE INDEX IF NOT EXISTS "CommissionLedger_orderId_idx" ON "CommissionLedger"("orderId");
CREATE INDEX IF NOT EXISTS "CommissionLedger_status_createdAt_idx" ON "CommissionLedger"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommissionLedger_sellerId_fkey') THEN
    ALTER TABLE "CommissionLedger"
      ADD CONSTRAINT "CommissionLedger_sellerId_fkey"
      FOREIGN KEY ("sellerId") REFERENCES "Seller"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommissionLedger_orderId_fkey') THEN
    ALTER TABLE "CommissionLedger"
      ADD CONSTRAINT "CommissionLedger_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommissionLedger_orderItemId_fkey') THEN
    ALTER TABLE "CommissionLedger"
      ADD CONSTRAINT "CommissionLedger_orderItemId_fkey"
      FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) Production-safe: Roblox (or name Roblox) zero stock → at least 50
UPDATE "Inventory" i
SET "qtyOnHand" = 50,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Product" p
WHERE i."productId" = p.id
  AND (p.slug = 'roblox' OR lower(p.name) = 'roblox')
  AND i."qtyOnHand" <= 0;

-- Ensure inventory row exists for Roblox if product exists without inventory
INSERT INTO "Inventory" ("id", "productId", "qtyOnHand", "qtyReserved", "warehouse", "updatedAt")
SELECT gen_random_uuid()::text, p.id, 50, 0, 'origin-91250', CURRENT_TIMESTAMP
FROM "Product" p
WHERE (p.slug = 'roblox' OR lower(p.name) = 'roblox')
  AND NOT EXISTS (SELECT 1 FROM "Inventory" i WHERE i."productId" = p.id);

-- 4) Active products missing images → placehold.co (same pattern as seed)
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position")
SELECT
  gen_random_uuid()::text,
  p.id,
  'https://placehold.co/800x800/1a1a1a/f5c518?text=' || replace(replace(replace(p.name, ' ', '%20'), '"', '%22'), '&', '%26'),
  p.name,
  0
FROM "Product" p
WHERE p.active = true
  AND NOT EXISTS (
    SELECT 1 FROM "ProductImage" pi
    WHERE pi."productId" = p.id
      AND pi.url IS NOT NULL
      AND btrim(pi.url) <> ''
  );
