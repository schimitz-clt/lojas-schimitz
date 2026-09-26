import type { Metadata } from 'next';
import { preload } from 'react-dom';
import HomePage from './home-client';
import { EditorialStage } from '@/components/RetailHome';
import type { Product } from '@/components/ProductCard';
import { resolveProductImageUrl } from '@/lib/product-media';
import { sellableCountFromCatalog, shouldUseRetailHome } from '@/lib/retail-home';

/** Homepage only. Other routes set their own canonical so they do not inherit `/`. */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/** Real sellable catalog for the editorial hero. Null keeps the marketplace home. */
async function loadRetailProducts(): Promise<Product[] | null> {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  try {
    const res = await fetch(`${api}/products?sellable=1&pageSize=5&sort=newest`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: unknown };
    const data = json?.data ?? json;
    if (!shouldUseRetailHome(sellableCountFromCatalog(data))) return null;
    const items = (Array.isArray(data) ? data : ((data as { items?: Product[] } | null)?.items ?? [])).filter(
      (item) => item && item.isDemo !== true,
    );
    const products = items.slice(0, 5);
    if (!products.length) return null;
    const img = resolveProductImageUrl(products[0]);
    if (img) preload(img, { as: 'image', fetchPriority: 'high' });
    return products;
  } catch {
    return null;
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const q = (await searchParams)?.q || '';
  const initialRetail = q ? null : await loadRetailProducts();
  return (
    <>
      {initialRetail?.length ? <EditorialStage products={initialRetail} /> : null}
      <HomePage initialRetail={initialRetail} suppressStage={!!initialRetail?.length} />
    </>
  );
}
