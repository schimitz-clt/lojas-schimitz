/**
 * Vitrine demonstrativa. A API continua sendo a barreira de compra.
 */

export const DEMO_SEAL_LABEL = 'Demonstrativo';

export const DEMO_PURCHASE_BLOCK_MESSAGE =
  'Produto demonstrativo — só de vitrine. Não entra na sacola, no pedido, na reserva de estoque nem no pagamento.';

export function isDemoCatalogProduct(p: { isDemo?: boolean | null } | null | undefined): boolean {
  return p?.isDemo === true;
}

export function cartHasDemoItem(
  items: Array<{ isDemo?: boolean | null }> | null | undefined,
): boolean {
  return (items || []).some((item) => item.isDemo === true);
}

export function catalogSplitCounts<T extends { isDemo?: boolean | null; active?: boolean }>(
  products: T[],
) {
  let demo = 0;
  let sellable = 0;
  let real = 0;
  for (const product of products) {
    if (product.isDemo) {
      demo += 1;
      continue;
    }
    real += 1;
    if (product.active !== false) sellable += 1;
  }
  return { demo, sellable, real, total: products.length };
}
