/**
 * Inventory quantity math — single source for available = onHand − reserved.
 * Never negative. CAS paths in InventoryService remain the write authority.
 */

/** Available units to sell: max(0, onHand − reserved). */
export function availableQty(qtyOnHand: number, qtyReserved: number): number {
  const onHand = Number(qtyOnHand);
  const reserved = Number(qtyReserved);
  if (!Number.isFinite(onHand) || !Number.isFinite(reserved)) return 0;
  return Math.max(0, onHand - reserved);
}

/** True when onHand/reserved would yield non-negative available (reserved ≤ onHand). */
export function isInventoryConsistent(qtyOnHand: number, qtyReserved: number): boolean {
  const onHand = Number(qtyOnHand);
  const reserved = Number(qtyReserved);
  if (!Number.isFinite(onHand) || !Number.isFinite(reserved)) return false;
  return onHand >= 0 && reserved >= 0 && reserved <= onHand;
}
