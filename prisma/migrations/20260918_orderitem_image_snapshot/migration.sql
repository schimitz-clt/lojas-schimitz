-- Additive: snapshot da foto de capa em OrderItem.
-- Pedidos antigos ficam NULL e o GET /orders faz fallback para ProductImage atual.

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
