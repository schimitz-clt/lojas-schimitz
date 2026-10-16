-- Aditiva: arquivamento de pedidos no admin (só esconde da lista; não muda status, pagamento, estoque nem relatórios).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Order_archivedAt_idx" ON "Order"("archivedAt");
