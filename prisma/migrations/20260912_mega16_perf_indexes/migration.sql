-- MEGA Phase 16 — additive indexes only (non-destructive).
-- Hot paths: ProductImage by product (catalog includes), OrderItem by order/product,
-- Product.active (public catalog where), Order (userId, status) composite.

CREATE INDEX IF NOT EXISTS "ProductImage_productId_idx" ON "ProductImage"("productId");

CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");

CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");

CREATE INDEX IF NOT EXISTS "Product_active_idx" ON "Product"("active");

CREATE INDEX IF NOT EXISTS "Order_userId_status_idx" ON "Order"("userId", "status");
