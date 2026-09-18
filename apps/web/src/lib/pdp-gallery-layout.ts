/**
 * PDP gallery frame geometry — full content-column width, square (1:1).
 *
 * PR #31 capped mobile `.pdp-carousel-slide` with `height`/`max-height` while
 * leaving `aspect-ratio: 1` and the default flex `min-width: auto` (from the
 * 800×800 <img>). Chromium then either:
 *   1. transferred the short height back onto width (tiny square), and/or
 *   2. let the slide grow to the image intrinsic width (~800px) so a
 *      `object-fit: contain` photo sat in the centre of an 800px box while
 *      the phone only showed the left ~360px — empty gutter + a strip on the right.
 *
 * Contract used by CSS + tests:
 * - slide width === track / content-column width (never image intrinsic size)
 * - height comes from 1:1 of that width (`height: auto`, no short max-height)
 * - never combine `aspect-ratio: 1` with a max-height smaller than the width
 */

export const PDP_GALLERY_ASPECT_CSS = '1 / 1';

/** Square frame that fills the carousel track. */
export function pdpGalleryFrameSize(trackWidthPx: number): { width: number; height: number } {
  const width = Math.max(0, Number.isFinite(trackWidthPx) ? trackWidthPx : 0);
  return { width, height: width };
}

/**
 * True when a max-height cap would fight 1:1 aspect-ratio and shrink width —
 * the mobile “photo stuck on the right” bug.
 */
export function pdpGalleryHeightCapShrinksWidth(trackWidthPx: number, maxHeightPx: number): boolean {
  const { height } = pdpGalleryFrameSize(trackWidthPx);
  return maxHeightPx < height;
}

/** CSS declarations that lock each slide to the track width. */
export function pdpGallerySlideWidthLock(): string[] {
  return ['flex: 0 0 100%', 'width: 100%', 'min-width: 100%', 'max-width: 100%'];
}
