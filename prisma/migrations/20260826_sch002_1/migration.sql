-- SCH-002.1
DROP INDEX IF EXISTS "Order_idempotencyKey_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Order_userId_idempotencyKey_key"
  ON "Order"("userId", "idempotencyKey");

ALTER TABLE "IdempotencyRecord" ADD COLUMN IF NOT EXISTS "requestHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "IdempotencyRecord" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "IdempotencyRecord" ALTER COLUMN "response" DROP NOT NULL;
