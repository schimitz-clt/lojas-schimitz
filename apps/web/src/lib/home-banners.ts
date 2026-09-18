/**
 * Home hero carousel — up to 5 banners, one snap at a time.
 * Swipe lives on the inner track; the page must not gain horizontal overflow
 * (same contract as the PDP gallery).
 */

import { isMissingOrPlaceholderImage } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';
import type { HomeBanner } from '@/lib/storefront';

export type { HomeBanner };

export const MAX_HOME_BANNERS = 5;
export const HOME_BANNER_AUTO_MS = 5500;
export const HOME_BANNER_RESUME_MS = 8000;
export const BANNER_TAP_SLOP_PX = 24;

export function bannerImageUrl(b: Pick<HomeBanner, 'imageUrl'>): string {
  const raw = typeof b.imageUrl === 'string' ? b.imageUrl.trim() : '';
  return rewritePublicUploadUrl(raw) || raw;
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

export function canCreateHomeBanner(existingCount: number): boolean {
  const n = Number.isFinite(existingCount) ? Math.trunc(existingCount) : 0;
  return n < MAX_HOME_BANNERS;
}

export function homeBannerLimitMessage(): string {
  return `Limite de ${MAX_HOME_BANNERS} banners na home. Edite ou exclua um existente.`;
}

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
