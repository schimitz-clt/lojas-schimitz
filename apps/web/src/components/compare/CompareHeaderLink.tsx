'use client';

import Link from 'next/link';
import { useCompare } from '@/components/compare/CompareProvider';
import { IconCompare } from '@/components/icons/StorefrontIcons';

export function CompareHeaderLink() {
  const { count } = useCompare();
  return (
    <Link className="hdr-link hdr-hide-sm" href="/comparar" prefetch={true}>
      <span className="hdr-link-ico" aria-hidden>
        <IconCompare size={17} />
      </span>
      Comparar
      {count > 0 ? <span className="hdr-badge">{count}</span> : null}
    </Link>
  );
}
