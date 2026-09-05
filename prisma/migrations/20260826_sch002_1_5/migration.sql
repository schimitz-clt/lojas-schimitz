-- SCH-002.1.5 — integridade de estoque
-- Não altera o algoritmo CAS da API. Sem jti (Fase C).

ALTER TABLE "Inventory"
  ADD CONSTRAINT "Inventory_qtyOnHand_nonneg"
  CHECK ("qtyOnHand" >= 0);

ALTER TABLE "Inventory"
  ADD CONSTRAINT "Inventory_qtyReserved_nonneg"
  CHECK ("qtyReserved" >= 0);

ALTER TABLE "Inventory"
  ADD CONSTRAINT "Inventory_reserved_lte_onhand"
  CHECK ("qtyReserved" <= "qtyOnHand");
