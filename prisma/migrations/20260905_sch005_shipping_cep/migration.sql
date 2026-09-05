-- SCH-005 — Frete própria por CEP (entrega do lojista). Aditiva.

CREATE TABLE IF NOT EXISTS "ShippingSettings" (
  "id" TEXT NOT NULL,
  "freeAbove" DECIMAL(12,2) NOT NULL,
  "defaultFee" DECIMAL(12,2) NOT NULL,
  "defaultDays" INTEGER NOT NULL DEFAULT 5,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShippingSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShippingCepRule" (
  "id" TEXT NOT NULL,
  "cepPrefix" TEXT NOT NULL,
  "fee" DECIMAL(12,2) NOT NULL,
  "estimatedDays" INTEGER NOT NULL DEFAULT 5,
  "label" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShippingCepRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShippingCepRule_cepPrefix_idx" ON "ShippingCepRule"("cepPrefix");
CREATE INDEX IF NOT EXISTS "ShippingCepRule_active_idx" ON "ShippingCepRule"("active");

-- Defaults alinhados ao NullShippingProvider anterior (grátis ≥ 299; senão R$ 19,90; 5 dias).
INSERT INTO "ShippingSettings" ("id", "freeAbove", "defaultFee", "defaultDays", "updatedAt")
VALUES ('default', 299.00, 19.90, 5, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
