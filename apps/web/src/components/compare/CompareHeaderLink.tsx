'use client';

import Link from 'next/link';
import { useCompare } from '@/components/compare/CompareProvider';

export function CompareHeaderLink() {
  const { count } = useCompare();
  return (
    <Link className="hdr-link hdr-hide-sm" href="/comparar">
      <span className="hdr-link-ico" aria-hidden>
        ⇄
      </span>
      Comparar
      {count > 0 ? <span className="hdr-badge">{count}</span> : null}
    </Link>
  );
}
