'use client';

import { useState } from 'react';
import { wishlistToggleLabel, type WishlistProductLike } from '@/lib/wishlist-ui';
import { useFavorites } from '@/components/favorites/FavoritesProvider';
import { IconHeart } from '@/components/icons/StorefrontIcons';

type Props = {
  productId?: string | null;
  product?: WishlistProductLike | null;
  variant?: 'card' | 'pdp';
};

function HeartIcon({ filled }: { filled: boolean }) {
  return <IconHeart size={20} filled={filled} />;
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
        data-testid="wishlist-heart"
      >
        <span aria-hidden className="fav-toggle-ico">
          <HeartIcon filled={on} />
        </span>
        <span className="fav-toggle-txt">{wishlistToggleLabel(on)}</span>
      </button>
    </div>
  );
}
