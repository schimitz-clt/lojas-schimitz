/**
 * Normalize cover + extra photo URLs for product create (máx. 10, same as MAX_PRODUCT_IMAGES).
 * Dedupes, trims, keeps first-seen order (index 0 = capa).
 * Does not import dto.ts (class-validator) so unit tests stay lightweight.
 */

export const CREATE_IMAGE_URL_MAX = 10;

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
