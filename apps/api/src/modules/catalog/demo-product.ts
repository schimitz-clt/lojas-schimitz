/**
 * Catálogo demonstrativo — guard puro.
 * isDemo=true nunca entra em sacola, pedido, reserva ou cobrança.
 * O import CSV comercial não usa este módulo e não liga a flag.
 */

export const DEMO_NOT_PURCHASABLE_CODE = 'DEMO_NOT_PURCHASABLE';

export const DEMO_NOT_PURCHASABLE_MESSAGE =
  'Produto demonstrativo não pode ser comprado, reservado ou cobrado. Este item é só de vitrine.';

export type DemoPurchaseSubject = {
  isDemo?: boolean | null;
  name?: string | null;
} | null | undefined;

export type DemoPurchaseRejection = {
  code: typeof DEMO_NOT_PURCHASABLE_CODE;
  message: string;
};

/** null quando o item pode seguir o fluxo comercial. */
export function demoPurchaseRejection(product: DemoPurchaseSubject): DemoPurchaseRejection | null {
  if (!product?.isDemo) return null;
  const name = typeof product.name === 'string' ? product.name.trim() : '';
  return {
    code: DEMO_NOT_PURCHASABLE_CODE,
    message: name
      ? `Produto demonstrativo "${name}" não pode ser comprado, reservado ou cobrado. Remova-o da sacola. Este item é só de vitrine.`
      : DEMO_NOT_PURCHASABLE_MESSAGE,
  };
}

/** Vendável = ativo e não demonstrativo. A vitrine de navegação inclui isDemo. */
export function sellableProductWhere<T extends Record<string, unknown>>(where: T): T & { isDemo: false } {
  return { ...where, isDemo: false };
}

export function demoProductWhere<T extends Record<string, unknown>>(where: T): T & { isDemo: true } {
  return { ...where, isDemo: true };
}
