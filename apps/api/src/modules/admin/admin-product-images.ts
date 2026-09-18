/**
 * Normalize cover + extra photo URLs for product create (máx. 10, same as MAX_PRODUCT_IMAGES).
 * Dedupes, trims, keeps first-seen order (index 0 = capa).
 * Does not import dto.ts (class-validator) so unit tests stay lightweight.
 */

export const CREATE_IMAGE_URL_MAX = 10;

/**
 * Cover URL to apply on product UPDATE.
 * Empty / whitespace / null / undefined → leave existing ProductImage rows alone.
 * Clearing photos is DELETE /admin/products/:id/images/:imageId only.
 *
 * 2026-09-18: PATCH with imageUrl '' / null deleted the cover row (Sansung A54 gallery wiped).
 */
export function coverUrlToApplyOnUpdate(
  imageUrl: string | null | undefined,
): string | undefined {
  if (typeof imageUrl !== 'string') return undefined;
  const url = imageUrl.trim();
  return url || undefined;
}

export function collectCreateImageUrls(
  input: { imageUrl?: string | null; imageUrls?: string[] | null },
  max = CREATE_IMAGE_URL_MAX,
): string[] {
  const cap = Number.isFinite(max) && max > 0 ? Math.floor(max) : CREATE_IMAGE_URL_MAX;
  const raw = [input.imageUrl, ...(Array.isArray(input.imageUrls) ? input.imageUrls : [])];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const url = typeof item === 'string' ? item.trim() : '';
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= cap) break;
  }
  return out;
}
