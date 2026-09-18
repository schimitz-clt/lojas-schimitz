'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  COMPARE_EVENT,
  compareFullMessage,
  isCompared,
  readCompareList,
  snapshotFromProduct,
  toggleCompareItem,
  writeCompareList,
  type CompareSnapshot,
  type ProductCompareLike,
} from '@/lib/product-compare';

type ToggleResult = { inList: boolean; reason?: 'full'; message?: string };

type CompareApi = {
  items: CompareSnapshot[];
  count: number;
  has: (id?: string | null) => boolean;
  toggle: (product: ProductCompareLike) => ToggleResult;
  remove: (id: string) => void;
  clear: () => void;
};

const CompareContext = createContext<CompareApi | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CompareSnapshot[]>([]);

  const refresh = useCallback(() => {
    setItems(readCompareList());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(COMPARE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(COMPARE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const persist = useCallback((next: CompareSnapshot[]) => {
    setItems(writeCompareList(next));
  }, []);

  const value = useMemo<CompareApi>(
    () => ({
      items,
      count: items.length,
      has: (id) => Boolean(id) && isCompared(items, String(id)),
      toggle: (product) => {
        const snap = snapshotFromProduct(product);
        if (!snap) return { inList: false };
        const result = toggleCompareItem(items, snap);
        persist(result.list);
        return {
          inList: result.inList,
          reason: result.reason,
          message: result.reason === 'full' ? compareFullMessage() : undefined,
        };
      },
      remove: (id) => persist(items.filter((x) => x.id !== id)),
      clear: () => persist([]),
    }),
    [items, persist],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareApi {
  const ctx = useContext(CompareContext);
  if (!ctx) {
    throw new Error('useCompare precisa de CompareProvider');
  }
  return ctx;
}
