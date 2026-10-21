-- Disponibilidade informativa (aditiva). Padrão "in_stock" = comportamento atual; nenhuma linha muda de regra.
ALTER TABLE "Product" ADD COLUMN "availability" TEXT NOT NULL DEFAULT 'in_stock';
ALTER TABLE "Product" ADD COLUMN "availabilityLeadDays" INTEGER;
ALTER TABLE "Product" ADD CONSTRAINT "Product_availability_check" CHECK ("availability" IN ('in_stock', 'made_to_order'));
ALTER TABLE "Product" ADD CONSTRAINT "Product_availabilityLeadDays_check" CHECK ("availabilityLeadDays" IS NULL OR ("availabilityLeadDays" BETWEEN 1 AND 120));
