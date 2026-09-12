/**
 * Health-adjacent admin ops helpers (inventory already exists).
 * Counts only — no product dump. Default threshold matches admin UI (5).
 */

export const DEFAULT_OPS_LOW_STOCK_THRESHOLD = 5;

export function isLowOnHand(
  qtyOnHand: number | null | undefined,
  threshold = DEFAULT_OPS_LOW_STOCK_THRESHOLD,
): boolean {
  if (qtyOnHand == null || !Number.isFinite(qtyOnHand)) return false;
  return qtyOnHand <= threshold;
}

export function summarizeInventoryOps(input: {
  lowStockCount: number;
  outOfStockCount: number;
  threshold?: number;
  time?: string;
}) {
  return {
    time: input.time || new Date().toISOString(),
    inventory: {
      lowStockThreshold: input.threshold ?? DEFAULT_OPS_LOW_STOCK_THRESHOLD,
      lowStockCount: input.lowStockCount,
      outOfStockCount: input.outOfStockCount,
    },
  };
}
