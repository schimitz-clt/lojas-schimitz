/**
 * Pure helpers for admin catalog search pagination and batch adjustments.
 * Legacy GET /admin/products (no q/page/pageSize/active) stays an array.
 */

export const ADMIN_PRODUCT_PAGE_DEFAULT = 24;
export const ADMIN_PRODUCT_PAGE_MAX = 50;
export const ADMIN_PRODUCT_BATCH_MAX = 200;
export const ADMIN_PRODUCT_PRICE_MAX = 9_999_999.99;
export const ADMIN_PRODUCT_STOCK_MAX = 1_000_000;

export type AdminProductListInput = {
  q?: string;
  page?: number;
  pageSize?: number;
  active?: boolean;
  lowStock?: number;
};

/** Unpaged array — existing Admin Catálogo load. Search/page opts switch to a page. */
export function isLegacyAdminProductList(input: AdminProductListInput): boolean {
  const q = (input.q || '').trim();
  return q.length === 0 && input.page == null && input.pageSize == null && input.active === undefined;
}

export function parseAdminProductPage(page?: number): number {
  const n = Math.floor(Number(page));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function parseAdminProductPageSize(pageSize?: number): number {
  const n = Math.floor(Number(pageSize));
  if (!Number.isFinite(n) || n < 1) return ADMIN_PRODUCT_PAGE_DEFAULT;
  return Math.min(ADMIN_PRODUCT_PAGE_MAX, n);
}

export function adminProductListWindow(input: AdminProductListInput): {
  page: number;
  pageSize: number;
  skip: number;
} {
  const page = parseAdminProductPage(input.page);
  const pageSize = parseAdminProductPageSize(input.pageSize);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

/** SKU and name only. There is no EAN column. */
export function buildAdminProductSearchWhere(input: AdminProductListInput) {
  const q = (input.q || '').trim();
  return {
    ...(input.active !== undefined ? { active: input.active } : {}),
    ...(input.lowStock != null ? { inventory: { qtyOnHand: { lte: input.lowStock } } } : {}),
    ...(q
      ? {
          OR: [
            { sku: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}

export type ProductBatchPlan =
  | { ok: false; error: string }
  | {
      ok: true;
      skus: string[];
      active?: boolean;
      price?: { mode: 'set' | 'percent'; value: number };
      stock?: { mode: 'set' | 'delta'; value: number };
    };

export function planProductBatch(input: {
  skus?: unknown;
  active?: boolean;
  priceMode?: 'set' | 'percent';
  priceValue?: number;
  stockMode?: 'set' | 'delta';
  stockValue?: number;
}): ProductBatchPlan {
  if (!Array.isArray(input.skus) || input.skus.length === 0) {
    return { ok: false, error: 'Informe ao menos um SKU. Nenhum produto foi alterado.' };
  }
  if (input.skus.length > ADMIN_PRODUCT_BATCH_MAX) {
    return {
      ok: false,
      error: `Máximo de ${ADMIN_PRODUCT_BATCH_MAX} SKUs por lote. Nenhum produto foi alterado.`,
    };
  }
  const skus: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.skus) {
    if (typeof raw !== 'string') {
      return { ok: false, error: 'SKU inválido. Nenhum produto foi alterado.' };
    }
    const sku = raw.trim();
    if (sku.length < 2 || sku.length > 64) {
      return { ok: false, error: `SKU inválido (${sku.slice(0, 64) || 'vazio'}). Nenhum produto foi alterado.` };
    }
    if (seen.has(sku)) continue;
    seen.add(sku);
    skus.push(sku);
  }
  if (!skus.length) {
    return { ok: false, error: 'Informe ao menos um SKU. Nenhum produto foi alterado.' };
  }

  const plan: Extract<ProductBatchPlan, { ok: true }> = { ok: true, skus };
  if (input.active !== undefined) {
    if (typeof input.active !== 'boolean') {
      return { ok: false, error: 'Ativo inválido. Nenhum produto foi alterado.' };
    }
    plan.active = input.active;
  }
  const hasPriceMode = input.priceMode != null;
  const hasPriceValue = input.priceValue != null;
  if (hasPriceMode || hasPriceValue) {
    if (input.priceMode !== 'set' && input.priceMode !== 'percent') {
      return { ok: false, error: 'Modo de preço inválido. Nenhum produto foi alterado.' };
    }
    if (typeof input.priceValue !== 'number' || !Number.isFinite(input.priceValue)) {
      return { ok: false, error: 'Valor de preço inválido. Nenhum produto foi alterado.' };
    }
    if (input.priceMode === 'set' && (input.priceValue < 0 || input.priceValue > ADMIN_PRODUCT_PRICE_MAX)) {
      return { ok: false, error: 'Preço fora da faixa. Nenhum produto foi alterado.' };
    }
    if (input.priceMode === 'percent' && (input.priceValue < -90 || input.priceValue > 500)) {
      return { ok: false, error: 'Percentual de preço fora da faixa (−90 a 500). Nenhum produto foi alterado.' };
    }
    plan.price = { mode: input.priceMode, value: input.priceValue };
  }
  const hasStockMode = input.stockMode != null;
  const hasStockValue = input.stockValue != null;
  if (hasStockMode || hasStockValue) {
    if (input.stockMode !== 'set' && input.stockMode !== 'delta') {
      return { ok: false, error: 'Modo de estoque inválido. Nenhum produto foi alterado.' };
    }
    if (typeof input.stockValue !== 'number' || !Number.isInteger(input.stockValue)) {
      return { ok: false, error: 'Estoque inválido. Nenhum produto foi alterado.' };
    }
    if (input.stockMode === 'set' && (input.stockValue < 0 || input.stockValue > ADMIN_PRODUCT_STOCK_MAX)) {
      return { ok: false, error: 'Estoque fora da faixa. Nenhum produto foi alterado.' };
    }
    if (input.stockMode === 'delta' && (input.stockValue < -ADMIN_PRODUCT_STOCK_MAX || input.stockValue > ADMIN_PRODUCT_STOCK_MAX)) {
      return { ok: false, error: 'Ajuste de estoque fora da faixa. Nenhum produto foi alterado.' };
    }
    plan.stock = { mode: input.stockMode, value: input.stockValue };
  }
  if (plan.active === undefined && !plan.price && !plan.stock) {
    return { ok: false, error: 'Nenhuma ação de lote (ativo, preço ou estoque). Nenhum produto foi alterado.' };
  }
  return plan;
}

export function nextBatchPrice(
  current: number,
  mode: 'set' | 'percent',
  value: number,
): number | null {
  if (!Number.isFinite(current) || current < 0) return null;
  const next = mode === 'set' ? value : current * (1 + value / 100);
  if (!Number.isFinite(next) || next < 0 || next > ADMIN_PRODUCT_PRICE_MAX) return null;
  return Math.round(next * 100) / 100;
}

export function nextBatchStock(
  onHand: number,
  mode: 'set' | 'delta',
  value: number,
): number | null {
  if (!Number.isInteger(onHand) || onHand < 0) return null;
  const next = mode === 'set' ? value : onHand + value;
  if (!Number.isInteger(next) || next < 0 || next > ADMIN_PRODUCT_STOCK_MAX) return null;
  return next;
}
