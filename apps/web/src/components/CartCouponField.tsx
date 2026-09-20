'use client';

import { brl } from '@/lib/api';
import { couponApplyBusyLabel, couponDiscountLineLabel } from '@/lib/cart-coupon';

type Applied = { code: string; discount: number } | null;

export function CartCouponField({
  id,
  value,
  onChange,
  applied,
  error,
  busy,
  onApply,
  onRemove,
  showLabel = true,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  applied: Applied;
  error: string;
  busy: boolean;
  onApply: () => void;
  onRemove: () => void;
  showLabel?: boolean;
}) {
  return (
    <div className="cart-coupon">
      {showLabel ? <label htmlFor={id}>Cupom</label> : null}
      {applied ? (
        <div className="cart-coupon-applied">
          <div className="cart-coupon-applied-copy">
            <strong>{couponDiscountLineLabel(applied.code)}</strong>
            <span className="ok">−{brl(applied.discount)}</span>
          </div>
          <button type="button" className="btn ghost" onClick={onRemove} disabled={busy}>
            Remover
          </button>
        </div>
      ) : (
        <div className="cart-coupon-row">
          <input
            id={id}
            aria-label="Cupom"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            placeholder="Ex.: SCHIMITZ10"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onApply();
              }
            }}
          />
          <button
            type="button"
            className="btn ghost"
            disabled={busy || !value.trim()}
            onClick={onApply}
          >
            {couponApplyBusyLabel(busy)}
          </button>
        </div>
      )}
      {error ? (
        <div className="alert" role="alert" style={{ marginTop: 8 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
