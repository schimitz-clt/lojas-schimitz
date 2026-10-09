import type { Metadata } from 'next';
import { preload } from 'react-dom';
import HomePage from './home-client';
import { EditorialStage } from '@/components/RetailHome';
import type { Product } from '@/components/ProductCard';
import { resolveProductImageUrl } from '@/lib/product-media';
import { IMAGE_WIDTHS, STAGE_IMG_SIZES, responsiveImageProps } from '@/lib/responsive-image';
import { homeShowsEditorialStage, sellableCountFromCatalog, shouldUseRetailHome } from '@/lib/retail-home';
import { interestFreeInstallmentPhrase } from '@/lib/pricing';
import { resolveApiProxyTarget } from '@/lib/api-proxy';
import {
  HOME_MARKET_CATALOG_PATH,
  HOME_MARKET_SHELVES_PATH,
  buildHomeMarketSeed,
  unwrapApiData,
  type HomeMarketSeed,
} from '@/lib/home-market';

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

async function fetchApiData(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${resolveApiProxyTarget()}/api/v1${path}`, {
      next: { revalidate: 60 },
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return unwrapApiData(await res.json());
  } catch {
    return null;
  }
}

/**
 * Market home (catalog > 5): products + shelves in the server HTML (SEO / first paint).
 * Failure → null and the client fetches as before.
 */
async function loadMarketSeed(): Promise<HomeMarketSeed<Product> | null> {
  const [catalog, shelves] = await Promise.all([
    fetchApiData(HOME_MARKET_CATALOG_PATH),
    fetchApiData(HOME_MARKET_SHELVES_PATH),
  ]);
  return buildHomeMarketSeed<Product>(catalog, shelves);
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
  const market = q || retail ? null : await loadMarketSeed();
  return (
    <>
      {retail && products?.length ? <EditorialStage products={products} /> : null}
      <HomePage initialRetail={retail ? products : null} initialMarket={market} suppressStage={retail} />
    </>
  );
}
