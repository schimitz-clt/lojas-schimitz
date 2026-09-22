/**
 * Normalize cover + extra photo URLs for product create (máx. 10, same as MAX_PRODUCT_IMAGES).
 * Dedupes, trims, keeps first-seen order (index 0 = capa).
 * Does not import dto.ts (class-validator) so unit tests stay lightweight.
 *
 * Placeholder hosts are rejected with a PT-BR error. URLs are never rewritten or dropped.
 */

import { BadRequestException } from '@nestjs/common';
import { isPlaceholderImageUrl } from './admin-ops';

export const CREATE_IMAGE_URL_MAX = 10;

/** Shown on admin create, update, and “adicionar foto por URL”. */
export const PLACEHOLDER_PRODUCT_IMAGE_URL_MESSAGE =
  'URL de imagem recusada: hosts de placeholder (placehold.co, placehold.it, via.placeholder.com e similares) não são aceitos. Envie uma foto real da loja.';

/**
 * PT-BR error when `url` is a known placeholder CDN.
 * Empty / whitespace is not an error (update already ignores an empty cover).
 * Returns the message only — does not replace the URL.
 */
export function placeholderProductImageUrlError(url: string | null | undefined): string | null {
  const t = typeof url === 'string' ? url.trim() : '';
  if (!t || !isPlaceholderImageUrl(t)) return null;
  return PLACEHOLDER_PRODUCT_IMAGE_URL_MESSAGE;
}

export function firstPlaceholderProductImageUrlError(
  urls: Array<string | null | undefined> | null | undefined,
): string | null {
  for (const url of urls || []) {
    const message = placeholderProductImageUrlError(url);
    if (message) return message;
  }
  return null;
}

/** Throws when any URL is a placeholder host. Does not filter or rewrite the list. */
export function assertNoPlaceholderProductImageUrls(
  urls: Array<string | null | undefined> | null | undefined,
): void {
  const message = firstPlaceholderProductImageUrlError(urls);
  if (message) throw new BadRequestException(message);
}

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
