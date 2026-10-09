import type { Metadata } from 'next';
import { preload } from 'react-dom';
import HomePage from './home-client';
import { EditorialStage } from '@/components/RetailHome';
import type { Product } from '@/components/ProductCard';
import { resolveProductImageUrl } from '@/lib/product-media';
import { IMAGE_WIDTHS, STAGE_IMG_SIZES, responsiveImageProps } from '@/lib/responsive-image';
import { homeShowsEditorialStage, sellableCountFromCatalog, shouldUseRetailHome } from '@/lib/retail-home';
import { interestFreeInstallmentPhrase } from '@/lib/pricing';

/** Homepage only. Other routes set their own canonical so they do not inherit `/`. */
export const metadata: Metadata = {
  title: {
    absolute: 'Lojas Schimitz — eletro, celulares e casa em Porto Alegre',
  },
  description:
    `Lojas Schimitz em Porto Alegre: eletro, celulares e casa. Frete grátis na capital, PIX 5% off e ${interestFreeInstallmentPhrase()}.`,
  alternates: { canonical: '/' },
};

/**
 * First sellable products for the abertura (at most five).
 * The boutique home still replaces the marketplace only when the catalog is 1–5.
 */
async function loadSellablePreview(): Promise<{ products: Product[]; retail: boolean } | null> {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  try {
    const res = await fetch(`${api}/products?sellable=1&pageSize=5&sort=newest`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: unknown };
    const data = json?.data ?? json;
    const retail = shouldUseRetailHome(sellableCountFromCatalog(data));
    const items = (Array.isArray(data) ? data : ((data as { items?: Product[] } | null)?.items ?? [])).filter(
      (item) => item && item.isDemo !== true,
    );
    const products = items.slice(0, 5);
    if (!products.length) return null;
    if (retail) {
      const img = resolveProductImageUrl(products[0]);
      if (img) {
        // Must match the <img> in EditorialStage (same srcSet/sizes) or the phone downloads the photo twice.
        const r = responsiveImageProps(img, IMAGE_WIDTHS.stage);
        preload(r.src, {
          as: 'image',
          fetchPriority: 'high',
          ...(r.srcSet ? { imageSrcSet: r.srcSet, imageSizes: STAGE_IMG_SIZES } : {}),
        });
      }
    }
    return { products, retail };
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
  const preview = q ? null : await loadSellablePreview();
  const products = preview?.products ?? null;
  const retail = homeShowsEditorialStage(!!preview?.retail, products?.length || 0);
  return (
    <>
      {retail && products?.length ? <EditorialStage products={products} /> : null}
      <HomePage initialRetail={retail ? products : null} suppressStage={retail} />
    </>
  );
}
