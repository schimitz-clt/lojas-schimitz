-- Catálogo demonstrativo: flag aditiva. Produtos existentes ficam isDemo=false.
-- Não apaga linhas, não altera preço/estoque e não mexe em pedidos.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Product_isDemo_idx" ON "Product"("isDemo");
CREATE INDEX IF NOT EXISTS "Product_active_isDemo_idx" ON "Product"("active", "isDemo");
