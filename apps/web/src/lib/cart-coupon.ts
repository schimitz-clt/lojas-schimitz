/** Display helpers for coupon on sacola / checkout. Server is authority. */

export type CartCouponPreview = {
  code: string;
  type?: string;
  value?: number;
  discount: number;
  finalSubtotal: number;
  collidesWithPixPromo?: boolean;
};

export type CartCouponError = {
  code: string;
  message: string;
};

export function cartDiscountAmount(
  coupon: CartCouponPreview | null | undefined,
  fallback = 0,
): number {
  if (coupon && Number.isFinite(Number(coupon.discount))) {
    return Math.max(0, Number(coupon.discount));
  }
  return Math.max(0, Number(fallback) || 0);
}

export function cartPayableTotal(subtotal: number, discount: number): number {
  return Math.round(Math.max(0, Number(subtotal) - Number(discount)) * 100) / 100;
}

export function couponDiscountLineLabel(code: string | null | undefined): string {
  const n = String(code || '').trim().toUpperCase();
  return n ? `Cupom ${n}` : 'Cupom';
}

export function couponApplyBusyLabel(busy: boolean): string {
  return busy ? 'Validando...' : 'Aplicar';
}
