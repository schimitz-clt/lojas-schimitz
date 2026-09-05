-- SCH-002 schema updates (aplicar via prisma migrate)
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'refunded';

ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "reservedCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "reservationExpiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT,
  "entityId" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE TABLE IF NOT EXISTS "IdempotencyRecord" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "userId" TEXT,
  "response" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyRecord_key_key" ON "IdempotencyRecord"("key");
CREATE INDEX IF NOT EXISTS "IdempotencyRecord_userId_idx" ON "IdempotencyRecord"("userId");

CREATE INDEX IF NOT EXISTS "Favorite_productId_idx" ON "Favorite"("productId");
