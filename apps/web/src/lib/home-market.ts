/**
 * Home "market" (catalog > 5 sellable items) rendered on the server, so crawlers and the first paint
 * see product links (before: the HTML only had the skeleton; everything loaded in the client).
 * Pure: shared by app/page.tsx (server) and home-client (seed state). Same pattern as department-page.
 */
import { activeProductCountFromCatalog } from '@/lib/coming-soon';
import {
  dedupeHomeShelves,
  parseHomeShelvesPayload,
  shelvesFromCatalog,
  type HomeShelfProductLike,
  type HomeShelfView,
} from '@/lib/home-shelves';
import { sellableCountFromCatalog, shouldUseRetailHome } from '@/lib/retail-home';

/** Same request the client makes for the home grid. */
export const HOME_MARKET_CATALOG_PATH = '/products?sort=newest&pageSize=48';
export const HOME_MARKET_SHELVES_PATH = '/store/shelves';

export type HomeMarketSeed<T extends HomeShelfProductLike> = {
  products: T[];
  activeCount: number;
  shelves: HomeShelfView<T>[];
};

/** API envelope `{ ok, data }` → data; raw arrays/objects pass through. */
export function unwrapApiData(json: unknown): unknown {
  if (json && typeof json === 'object' && !Array.isArray(json) && 'data' in json) {
    return (json as { data: unknown }).data;
  }
  return json;
}

/**
 * Seed for the market home, or null when the client must decide (retail home with 1–5 products,
 * invalid payload, empty catalog). Shelves fall back to the catalog exactly like the client does.
 */
export function buildHomeMarketSeed<T extends HomeShelfProductLike>(
  catalog: unknown,
  shelvesPayload: unknown | null,
): HomeMarketSeed<T> | null {
  if (!catalog || typeof catalog !== 'object') return null;
  const items = (Array.isArray(catalog) ? catalog : (catalog as { items?: unknown }).items) as T[] | undefined;
  if (!Array.isArray(items) || items.length === 0) return null;
  if (shouldUseRetailHome(sellableCountFromCatalog(catalog))) return null;
  const parsed = shelvesPayload == null ? null : parseHomeShelvesPayload<T>(shelvesPayload);
  return {
    products: items,
    activeCount: activeProductCountFromCatalog(catalog),
    shelves: dedupeHomeShelves(parsed ?? shelvesFromCatalog(items)),
  };
}
