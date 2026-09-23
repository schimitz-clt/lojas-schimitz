/**
 * Home hero carousel — up to 5 banners, one snap at a time.
 * Swipe lives on the inner track; the page must not gain horizontal overflow
 * (same contract as the PDP gallery). 2+ slides loop via clones so the last
 * banner is never a dead-end, and CSS snap stays light (stop: normal).
 */

import { isMissingOrPlaceholderImage } from '@/lib/placeholder-image';
import { localizeStorefrontUploadUrl, rewritePublicUploadUrl } from '@/lib/public-upload-url';
import type { HomeBanner } from '@/lib/storefront';

export type { HomeBanner };

export const MAX_HOME_BANNERS = 5;
export const HOME_BANNER_AUTO_MS = 5500;
export const HOME_BANNER_RESUME_MS = 8000;
export const HOME_BANNER_SETTLE_MS = 120;
export const BANNER_TAP_SLOP_PX = 24;

/** One slot in the looping track (clones of first/last when there are 2+ slides). */
export type HomeBannerLoopSlot<T> = {
  key: string;
  item: T;
  clone: boolean;
  logicalIndex: number;
};

export function bannerImageUrl(b: Pick<HomeBanner, 'imageUrl'>): string {
  const raw = typeof b.imageUrl === 'string' ? b.imageUrl.trim() : '';
  const rewritten = rewritePublicUploadUrl(raw) || raw;
  return localizeStorefrontUploadUrl(rewritten);
}

export function isUsableHomeBanner(b: HomeBanner | null | undefined): b is HomeBanner {
  if (!b || typeof b !== 'object') return false;
  const url = bannerImageUrl(b);
  return Boolean(url) && !isMissingOrPlaceholderImage(url);
}

/** Active, real-image banners only — never more than 5 slides. */
export function takeUsableHomeBanners(list: HomeBanner[] | null | undefined): HomeBanner[] {
  const rows = Array.isArray(list) ? list : [];
  return rows.filter(isUsableHomeBanner).slice(0, MAX_HOME_BANNERS);
}

/** Total HomeBanner rows (active + inactive). Create limit is 5 total, not 5 active. */
export function homeBannerRowCount(banners: { length?: number } | null | undefined): number {
  const n = banners && typeof banners.length === 'number' ? banners.length : 0;
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

export function canCreateHomeBanner(existingCount: number): boolean {
  const n = Number.isFinite(existingCount) ? Math.trunc(existingCount) : 0;
  return n < MAX_HOME_BANNERS;
}

export function homeBannerLimitMessage(): string {
  return `Limite de ${MAX_HOME_BANNERS} banners na home. Edite ou exclua um existente.`;
}

export function homeBannerSlotCounter(count: number): string {
  const n = Math.max(0, Math.trunc(Number(count) || 0));
  return `${Math.min(n, MAX_HOME_BANNERS)} de ${MAX_HOME_BANNERS}`;
}

export function bannerCreateCtaLabel(existingCount: number): string {
  const n = Math.max(0, Math.trunc(Number(existingCount) || 0));
  return n > 0 ? 'Criar outro banner' : 'Criar banner';
}

export function bannerCreatedToast(countAfterCreate: number): string {
  const n = Math.max(0, Math.trunc(Number(countAfterCreate) || 0));
  const shown = Math.min(n, MAX_HOME_BANNERS);
  if (shown >= MAX_HOME_BANNERS) {
    return `Banner criado. Limite de ${MAX_HOME_BANNERS} atingido.`;
  }
  return `Banner criado. Pode adicionar mais (${shown}/${MAX_HOME_BANNERS}).`;
}

export const ADMIN_BANNER_FORM_ID = 'admin-banner-form';
export const ADMIN_BANNER_TITLE_ID = 'admin-banner-title';

export function homeBannerCountHint(count: number): string {
  const n = Math.max(0, Math.trunc(Number(count) || 0));
  if (n <= 0) {
    return `Até ${MAX_HOME_BANNERS} banners. Só os ativos aparecem na home, um por vez (swipe).`;
  }
  if (n >= MAX_HOME_BANNERS) {
    return `${MAX_HOME_BANNERS} de ${MAX_HOME_BANNERS} banners. Exclua ou edite um para trocar.`;
  }
  return `${n} de ${MAX_HOME_BANNERS} banners. A home mostra um por vez, com swipe.`;
}

export function shouldShowBannerChrome(total: number): boolean {
  return total > 1;
}

export function nextBannerIndex(current: number, total: number, delta: number): number {
  if (total <= 0) return 0;
  const n = Number.isFinite(current) ? Math.trunc(current) : 0;
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return ((n + step) % total + total) % total;
}

export function clampBannerIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  if (!Number.isFinite(current)) return 0;
  return Math.min(Math.max(0, Math.trunc(current)), total - 1);
}

/** Real slides plus leading/trailing clones so last→first is one snap, not a rewind. */
export function homeBannerTrackLength(total: number): number {
  const n = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0;
  if (n <= 1) return n;
  return n + 2;
}

function loopSlotKey(id: string | undefined, index: number, clone: false | 'start' | 'end'): string {
  const base = typeof id === 'string' && id.trim() ? id.trim() : `i${index}`;
  if (clone === 'start') return `${base}__clone-start`;
  if (clone === 'end') return `${base}__clone-end`;
  return base;
}

export function homeBannerLoopSlides<T extends { id?: string }>(
  items: T[] | null | undefined,
): HomeBannerLoopSlot<T>[] {
  const rows = Array.isArray(items) ? items : [];
  if (rows.length === 0) return [];
  if (rows.length === 1) {
    return [{ key: loopSlotKey(rows[0]?.id, 0, false), item: rows[0], clone: false, logicalIndex: 0 }];
  }
  const lastI = rows.length - 1;
  const last = rows[lastI];
  const first = rows[0];
  return [
    { key: loopSlotKey(last?.id, lastI, 'start'), item: last, clone: true, logicalIndex: lastI },
    ...rows.map((item, i) => ({
      key: loopSlotKey(item?.id, i, false),
      item,
      clone: false,
      logicalIndex: i,
    })),
    { key: loopSlotKey(first?.id, 0, 'end'), item: first, clone: true, logicalIndex: 0 },
  ];
}

/** DOM index of a real slide (0 when there is no loop). */
export function loopingTrackIndex(logical: number, total: number): number {
  if (total <= 1) return 0;
  return clampBannerIndex(logical, total) + 1;
}

export function logicalFromTrackIndex(trackIndex: number, total: number): number {
  if (total <= 1) return 0;
  const t = Number.isFinite(trackIndex) ? Math.trunc(trackIndex) : 0;
  if (t <= 0) return total - 1;
  if (t >= total + 1) return 0;
  return clampBannerIndex(t - 1, total);
}

/**
 * Track index to scroll for a ±1 step. Wrapping uses the clone so the finger
 * (or auto-advance) moves one slide, not back across the whole strip.
 */
export function loopingAdvanceTrackIndex(logical: number, total: number, delta: number): number {
  if (total <= 1) return 0;
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  const cur = clampBannerIndex(logical, total);
  if (step > 0 && cur === total - 1) return total + 1;
  if (step < 0 && cur === 0) return 0;
  return loopingTrackIndex(nextBannerIndex(cur, total, step), total);
}

/** After snap settles on a clone, jump to the matching real slide (instant). */
export function loopingCloneJump(trackIndex: number, total: number): number | null {
  if (total <= 1) return null;
  const t = Number.isFinite(trackIndex) ? Math.trunc(trackIndex) : 0;
  if (t <= 0) return total;
  if (t >= total + 1) return 1;
  return null;
}

export function trackIndexFromScroll(scrollLeft: number, width: number, trackCount: number): number {
  const w = Number.isFinite(width) && width > 0 ? width : 1;
  const max = Math.max(0, (Number.isFinite(trackCount) ? Math.trunc(trackCount) : 0) - 1);
  const i = Math.round((Number.isFinite(scrollLeft) ? scrollLeft : 0) / w);
  return Math.min(Math.max(0, i), max);
}

export function bannerImageIsPriority(clone: boolean, logicalIndex: number): boolean {
  return !clone && logicalIndex === 0;
}

/**
 * Decode the first screen plus one swipe either way.
 * The rest stay lazy so a 5-slide track does not decode every bitmap during scroll.
 */
export function bannerImagePreload(clone: boolean, logicalIndex: number, total: number): boolean {
  if (bannerImageIsPriority(clone, logicalIndex)) return true;
  const n = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0;
  if (n <= 1) return !clone;
  if (!clone && logicalIndex === 1) return true;
  if (clone && logicalIndex === n - 1) return true;
  return false;
}

export function bannerScrollBehavior(smooth: boolean): ScrollBehavior {
  if (!smooth) return 'auto';
  if (typeof window === 'undefined') return 'smooth';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'auto';
  // A smooth scrollTo on touch runs while the finger may be moving the page.
  // Native snap already animates the swipe; auto-advance just cuts.
  if (window.matchMedia('(pointer: coarse)').matches) return 'auto';
  return 'smooth';
}

export function bannerCtaLabel(): string {
  return 'Conferir agora';
}

export function bannerCtaHref(b: Pick<HomeBanner, 'linkUrl'> | null | undefined): string {
  const raw = typeof b?.linkUrl === 'string' ? b.linkUrl.trim() : '';
  return raw || '/departamento/ofertas';
}

export function bannerAlt(b: Pick<HomeBanner, 'alt' | 'title'>): string {
  return (b.alt || b.title || 'Banner').trim() || 'Banner';
}

export function bannerAriaLabel(index: number, total: number): string {
  if (total <= 1) return 'Destaques';
  const n = clampBannerIndex(index, total) + 1;
  return `Destaques (${n} de ${total})`;
}

export function bannerNavPrevLabel(): string {
  return 'Banner anterior';
}

export function bannerNavNextLabel(): string {
  return 'Próximo banner';
}

export function bannerDotLabel(index: number): string {
  return `Banner ${Math.max(1, Math.trunc(index) + 1)}`;
}

/** Finger still counts as a tap (opens the CTA) rather than a swipe. */
export function bannerTapOpensLink(dx: number, dy: number): boolean {
  const slop = BANNER_TAP_SLOP_PX;
  return dx * dx + dy * dy <= slop * slop;
}

/** CSS declarations that lock each slide to the track width (no page overflow). */
export function homeBannerSlideWidthLock(): string[] {
  return ['flex: 0 0 100%', 'width: 100%', 'min-width: 100%', 'max-width: 100%'];
}

/** Shared strip ratios — every slide uses the same box; images crop, they do not resize it. */
export const HOME_BANNER_ASPECT_DEFAULT = { w: 21, h: 8 } as const;
export const HOME_BANNER_ASPECT_MOBILE = { w: 16, h: 10 } as const;
export const HOME_BANNER_ASPECT_DESKTOP = { w: 21, h: 7 } as const;

export function homeBannerAspectCss(aspect: { w: number; h: number }): string {
  return `${aspect.w} / ${aspect.h}`;
}

export function homeBannerFrameSize(
  trackWidthPx: number,
  aspect: { w: number; h: number } = HOME_BANNER_ASPECT_DEFAULT,
): { width: number; height: number } {
  const width = Math.max(0, Number.isFinite(trackWidthPx) ? trackWidthPx : 0);
  const aw = Number.isFinite(aspect.w) && aspect.w > 0 ? aspect.w : 1;
  const ah = Number.isFinite(aspect.h) && aspect.h > 0 ? aspect.h : 1;
  return { width, height: (width * ah) / aw };
}

/** A min-height larger than the aspect box fights the frame (PDP gallery lesson). */
export function homeBannerMinHeightFightsAspect(
  trackWidthPx: number,
  minHeightPx: number,
  aspect: { w: number; h: number } = HOME_BANNER_ASPECT_DEFAULT,
): boolean {
  const { height } = homeBannerFrameSize(trackWidthPx, aspect);
  return Number.isFinite(minHeightPx) && minHeightPx > height;
}

export function homeBannerSlideFrameLock(): string[] {
  return [...homeBannerSlideWidthLock(), 'height: 100%', 'min-height: 0', 'max-height: 100%'];
}

export function homeBannerImageFit(): string {
  return 'object-fit: cover';
}
