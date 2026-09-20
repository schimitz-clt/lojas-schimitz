'use client';

import { useState } from 'react';
import { wishlistToggleLabel, type WishlistProductLike } from '@/lib/wishlist-ui';
import { useFavorites } from '@/components/favorites/FavoritesProvider';

type Props = {
  productId?: string | null;
  product?: WishlistProductLike | null;
  variant?: 'card' | 'pdp';
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        d="M12 20s-7.4-4.5-9.4-8.4C1.2 8.8 2.1 5.6 5.2 4.8 7.2 4.2 9 5.1 12 8c3-2.9 4.8-3.8 6.8-3.2 3.1.8 4 4 2.6 6.8C19.4 15.5 12 20 12 20z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FavoriteToggle({ productId, product, variant = 'card' }: Props) {
  const { has, toggle } = useFavorites();
  const id = productId || product?.id || '';
  const on = has(id);
  const [busy, setBusy] = useState(false);

  async function onClick(e: { preventDefault(): void; stopPropagation(): void }) {
    e.preventDefault();
    e.stopPropagation();
    if (!id || busy) return;
    setBusy(true);
    try {
      await toggle(id, product);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`fav-toggle fav-toggle-${variant}`}>
      <button
        type="button"
        className={`fav-toggle-btn${on ? ' is-on' : ''}`}
        onClick={onClick}
        disabled={busy}
        aria-pressed={on}
        aria-busy={busy || undefined}
        aria-label={wishlistToggleLabel(on)}
        title={wishlistToggleLabel(on)}
      >
        <span aria-hidden className="fav-toggle-ico">
          <HeartIcon filled={on} />
        </span>
        <span className="fav-toggle-txt">{wishlistToggleLabel(on)}</span>
      </button>
    </div>
  );
}
