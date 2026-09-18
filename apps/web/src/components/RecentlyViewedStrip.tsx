'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { brl } from '@/lib/api';
import { pixPrice } from '@/lib/pricing';
import {
  RECENT_EVENT,
  clearRecentList,
  readRecentList,
  recentClearLabel,
  recentListExcluding,
  recentStripHeading,
  shouldShowRecentStrip,
  type RecentSnapshot,
} from '@/lib/recently-viewed';

type Props = {
  excludeId?: string | null;
  excludeSlug?: string | null;
};

export function RecentlyViewedStrip({ excludeId, excludeSlug }: Props) {
  const path = usePathname() || '/';
  const [items, setItems] = useState<RecentSnapshot[]>([]);

  const refresh = useCallback(() => {
    setItems(recentListExcluding(readRecentList(), excludeId, excludeSlug));
  }, [excludeId, excludeSlug]);

  useEffect(() => {
    refresh();
    window.addEventListener(RECENT_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(RECENT_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const heading = recentStripHeading(items.length);
  if (!shouldShowRecentStrip(path, items.length)) return null;

  return (
    <section className="recent-strip" aria-labelledby="recent-strip-title">
      <div className="section-head">
        <div>
          <h2 id="recent-strip-title">{heading.title}</h2>
          <p className="muted recent-strip-sub">{heading.subtitle}</p>
        </div>
        <button
          type="button"
          className="recent-strip-clear"
          onClick={() => {
            clearRecentList();
            setItems([]);
          }}
        >
          {recentClearLabel()}
        </button>
      </div>
      <ul className="recent-strip-rail">
        {items.map((item) => {
          const pix = item.price > 0 ? pixPrice(item.price) : 0;
          return (
            <li key={item.id} className="recent-card">
              <Link href={`/produto/${item.slug}`} className="recent-card-link">
                <div className="recent-card-media">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" width={160} height={160} loading="lazy" />
                  ) : (
                    <span className="recent-card-ph" aria-hidden>
                      SCH
                    </span>
                  )}
                </div>
                {item.categoryName ? <p className="recent-card-cat">{item.categoryName}</p> : null}
                <h3 className="recent-card-title">{item.name}</h3>
                {item.price > 0 ? (
                  <p className="recent-card-price">
                    <strong>{brl(pix)}</strong>
                    <span className="muted"> no PIX</span>
                  </p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
