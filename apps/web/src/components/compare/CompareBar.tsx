'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { compareBarLabel, shouldShowCompareBar } from '@/lib/product-compare';
import { useCompare } from '@/components/compare/CompareProvider';

export function CompareBar() {
  const path = usePathname() || '/';
  const { items, count, remove, clear } = useCompare();

  if (!shouldShowCompareBar(path, count)) return null;

  return (
    <aside className="compare-bar" aria-label="Comparação de produtos">
      <div className="compare-bar-slots">
        {items.map((item) => (
          <div key={item.id} className="compare-bar-slot">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt="" width={40} height={40} />
            ) : (
              <span className="compare-bar-ph" aria-hidden>
                LS
              </span>
            )}
            <span className="compare-bar-name">{item.name}</span>
            <button
              type="button"
              className="compare-bar-x"
              aria-label={`Remover ${item.name} da comparação`}
              onClick={() => remove(item.id)}
            >
              ×
            </button>
          </div>
        ))}
        {Array.from({ length: Math.max(0, 3 - items.length) }, (_, i) => (
          <div key={`empty-${i}`} className="compare-bar-slot is-empty" aria-hidden>
            <span>+</span>
          </div>
        ))}
      </div>
      <div className="compare-bar-actions">
        <span className="compare-bar-count">{compareBarLabel(count)}</span>
        <Link className="btn compare-bar-go" href="/comparar">
          Comparar agora
        </Link>
        <button type="button" className="btn ghost compare-bar-clear" onClick={clear}>
          Limpar
        </button>
      </div>
    </aside>
  );
}
