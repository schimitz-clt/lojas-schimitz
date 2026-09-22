-- Catálogo massivo: category filter joins Product.categoryId.
-- sku and slug are already UNIQUE; active already indexed. No EAN column.
-- Additive only.

CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product"("categoryId");
