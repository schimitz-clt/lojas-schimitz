'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ProductCard, type Product } from '@/components/ProductCard';
import {
  ACCOUNT_HUB_TITLE,
  ACCOUNT_VISTOS_PATH,
  recentVistosEmptyCopy,
} from '@/lib/account-menu';
import {
  RECENT_EVENT,
  readRecentList,
  recentClearLabel,
  recentStripHeading,
  type RecentSnapshot,
  writeRecentList,
} from '@/lib/recently-viewed';

function asProduct(item: RecentSnapshot): Product {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    price: item.price,
    compareAtPrice: item.compareAtPrice,
    image: item.image,
    category: item.categoryName ? { slug: '', name: item.categoryName } : null,
  };
}

export default function ContaVistosPage() {
  const [items, setItems] = useState<RecentSnapshot[]>([]);

  const refresh = useCallback(() => {
    setItems(readRecentList());
  }, []);

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
  const empty = recentVistosEmptyCopy();

  return (
    <div className="account-hub account-vistos">
      <p className="account-hub-back">
        <Link href="/conta">← {ACCOUNT_HUB_TITLE}</Link>
      </p>
      <header className="account-hub-head">
        <h1 className="account-hub-title">{heading.title}</h1>
        <p className="account-hub-sub muted">{heading.subtitle}</p>
      </header>

      {items.length === 0 ? (
        <section className="account-hub-card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>{empty.title}</h2>
          <p className="muted">{empty.body}</p>
          <Link className="btn" href={empty.ctaHref}>
            {empty.ctaLabel}
          </Link>
        </section>
      ) : (
        <>
          <p className="account-hub-back" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                writeRecentList([]);
                setItems([]);
              }}
            >
              {recentClearLabel()}
            </button>
          </p>
          <div className="grid grid-vitrine">
            {items.map((item) => (
              <ProductCard key={`${ACCOUNT_VISTOS_PATH}-${item.id}`} p={asProduct(item)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
