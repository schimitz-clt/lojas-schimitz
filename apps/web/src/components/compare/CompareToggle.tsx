'use client';

import { useState } from 'react';
import { compareToggleLabel, type ProductCompareLike } from '@/lib/product-compare';
import { useCompare } from '@/components/compare/CompareProvider';

type Props = {
  product: ProductCompareLike;
  variant?: 'card' | 'pdp';
};

export function CompareToggle({ product, variant = 'card' }: Props) {
  const { has, toggle } = useCompare();
  const id = product.id || '';
  const on = has(id);
  const [hint, setHint] = useState('');

  function onClick(e: { preventDefault(): void; stopPropagation(): void }) {
    e.preventDefault();
    e.stopPropagation();
    const result = toggle(product);
    if (result.reason === 'full' && result.message) {
      setHint(result.message);
      window.setTimeout(() => setHint(''), 3200);
      return;
    }
    setHint('');
  }

  return (
    <div className={`compare-toggle compare-toggle-${variant}`}>
      <button
        type="button"
        className={`compare-toggle-btn${on ? ' is-on' : ''}`}
        onClick={onClick}
        aria-pressed={on}
        aria-label={compareToggleLabel(on)}
        title={hint || compareToggleLabel(on)}
      >
        <span aria-hidden className="compare-toggle-ico">
          {on ? '✓' : '⇄'}
        </span>
        <span className="compare-toggle-txt">{compareToggleLabel(on)}</span>
      </button>
      {hint ? (
        <p className="compare-toggle-hint" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
