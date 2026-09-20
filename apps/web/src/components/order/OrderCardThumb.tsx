'use client';

import { extraItemsLabel } from '@/lib/order-card-ui';

/** Magalu-style order thumbnail: snapshot photo or SCH+ placeholder. */
export function OrderCardThumb({
  src,
  extra = 0,
  badge,
  className,
}: {
  src: string;
  extra?: number;
  badge?: string | null;
  className?: string;
}) {
  const shown = badge === undefined ? extraItemsLabel(extra) : badge;
  return (
    <div className={className ? `order-card-thumb ${className}` : 'order-card-thumb'} aria-hidden="true">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={72}
          height={72}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            const el = e.currentTarget;
            el.style.display = 'none';
            const ph = el.parentElement?.querySelector('.order-card-thumb-ph');
            if (ph instanceof HTMLElement) ph.style.display = 'flex';
          }}
        />
      ) : null}
      <span className="order-card-thumb-ph" style={src ? { display: 'none' } : undefined}>
        <span className="order-card-thumb-ph-mark">
          SCH<em>+</em>
        </span>
      </span>
      {shown ? <span className="order-card-thumb-more">{shown}</span> : null}
    </div>
  );
}
