-- SCH-007 ops — novos status de fulfillment (entrega própria).
-- ADD VALUE em migration separada: novo enum só pode ser usado após commit.

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'organizing';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'packing';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ready_for_pickup';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'in_transit';
