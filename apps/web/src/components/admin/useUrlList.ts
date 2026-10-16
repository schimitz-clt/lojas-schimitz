'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ListParamKey, parsePage, readListParam, withListParams } from '@/lib/admin-list-params';

/** Busca (com atraso), ordenação e página das listas do admin, guardadas na URL. */
export function useUrlList(defaultSort: string) {
  const router = useRouter();
  const pathname = usePathname() || '/admin';
  const sp = useSearchParams();
  const urlQ = readListParam(sp, 'busca');
  const [search, setSearch] = useState(urlQ);
  const set = (patch: Partial<Record<ListParamKey, string | number | null | undefined>>) =>
    router.replace(`${pathname}${withListParams(sp, patch)}`, { scroll: false });
  useEffect(() => {
    if (search.trim() === urlQ) return;
    const t = setTimeout(() => set({ busca: search.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  return {
    search,
    setSearch,
    q: urlQ,
    sort: readListParam(sp, 'ordem') || defaultSort,
    setSort: (v: string) => set({ ordem: v === defaultSort ? '' : v }),
    page: parsePage(readListParam(sp, 'pagina')),
    setPage: (p: number) => set({ pagina: p }),
    setParams: set,
    params: sp,
  };
}
