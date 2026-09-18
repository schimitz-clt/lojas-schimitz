'use client';

import { wishlistToggleLabel } from '@/lib/wishlist-ui';
import { useFavorites } from '@/components/favorites/FavoritesProvider';

type Props = {
  productId?: string | null;
  variant?: 'card' | 'pdp';
};

export function FavoriteToggle({ productId, variant = 'card' }: Props) {
  const { has, toggle } = useFavorites();
  const id = productId || '';
  const on = has(id);

  async function onClick(e: { preventDefault(): void; stopPropagation(): void }) {
    e.preventDefault();
    e.stopPropagation();
    if (!id) return;
    await toggle(id);
  }

  return (
    <div className={`fav-toggle fav-toggle-${variant}`}>
      <button
        type="button"
        className={`fav-toggle-btn${on ? ' is-on' : ''}`}
        onClick={onClick}
        aria-pressed={on}
        aria-label={wishlistToggleLabel(on)}
        title={wishlistToggleLabel(on)}
      >
        <span aria-hidden className="fav-toggle-ico">
          {on ? '♥' : '♡'}
        </span>
        <span className="fav-toggle-txt">{wishlistToggleLabel(on)}</span>
      </button>
    </div>
  );
}
