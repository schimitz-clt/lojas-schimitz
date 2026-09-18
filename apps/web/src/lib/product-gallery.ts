/**
 * PDP gallery helpers — normalize catalog image URLs, wrap indexes, Portuguese copy.
 * No DOM. Lightbox/zoom uses the same public URLs (no invented variants).
 */

import { isMissingOrPlaceholderImage } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';

export type GalleryImageInput = {
  url?: string | null;
  position?: number;
  alt?: string | null;
};

export type GalleryImage = {
  url: string;
  alt: string;
};

export type GallerySource = {
  images?: GalleryImageInput[] | null;
  image?: string | null;
  imageUrl?: string | null;
  name?: string | null;
};

function cleanUrl(raw: string | null | undefined): string {
  const t = (raw || '').trim();
  if (!t) return '';
  const rewritten = rewritePublicUploadUrl(t) || t;
  if (isMissingOrPlaceholderImage(rewritten)) return '';
  return rewritten;
}

/** Unique usable photos, position-sorted, with Portuguese alt fallback. */
export function buildProductGallery(source: GallerySource): GalleryImage[] {
  const name = (source.name || '').trim() || 'Produto';
  const sorted = [...(source.images || [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const out: GalleryImage[] = [];
  const seen = new Set<string>();

  for (const img of sorted) {
    const url = cleanUrl(img.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const alt = (img.alt || '').trim() || (out.length === 0 ? name : `${name} — foto ${out.length + 1}`);
    out.push({ url, alt });
  }

  if (out.length) return out;

  const flat = cleanUrl(source.image) || cleanUrl(source.imageUrl);
  return flat ? [{ url: flat, alt: name }] : [];
}

/** Wrap gallery index (keyboard / swipe). Empty gallery stays at 0. */
export function nextGalleryIndex(current: number, total: number, delta: number): number {
  if (total <= 0) return 0;
  const n = Number.isFinite(current) ? Math.trunc(current) : 0;
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return ((n + step) % total + total) % total;
}

export function clampGalleryIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  if (!Number.isFinite(current)) return 0;
  return Math.min(Math.max(0, Math.trunc(current)), total - 1);
}

export function galleryCounterLabel(index: number, total: number): string {
  if (total <= 0) return 'Sem fotos';
  const n = clampGalleryIndex(index, total) + 1;
  return `Foto ${n} de ${total}`;
}

export function galleryAriaLabel(productName: string, index: number, total: number): string {
  const name = productName.trim() || 'Produto';
  if (total <= 1) return `Fotos de ${name}`;
  return `Fotos de ${name} (${galleryCounterLabel(index, total)})`;
}

export function galleryZoomHint(zoomed: boolean): string {
  return zoomed ? 'Toque para reduzir' : 'Toque para ampliar';
}

export function galleryOpenLabel(): string {
  return 'Ampliar imagem';
}

export function galleryCloseLabel(): string {
  return 'Fechar imagem ampliada';
}
