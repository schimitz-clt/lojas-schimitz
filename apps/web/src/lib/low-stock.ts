/**
 * Honest low-stock urgency — real available units only.
 * Never invent viewer counts or “restam N” without a numeric stock.
 */

export const LOW_STOCK_MAX = 3;
export const LOW_STOCK_LABEL = 'Últimas unidades';

/** True only for a finite available stock of 1–3 (inclusive). */
export function shouldShowLowStock(stock: number | null | undefined): boolean {
  if (typeof stock !== 'number' || !Number.isFinite(stock)) return false;
  const n = Math.floor(stock);
  return n >= 1 && n <= LOW_STOCK_MAX;
}
