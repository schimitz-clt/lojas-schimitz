/** Home banner carousel — at most 5 slides on the vitrine. */

export const MAX_HOME_BANNERS = 5;

export function takeHomeBanners<T>(rows: T[] | null | undefined): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, MAX_HOME_BANNERS);
}

export function canCreateHomeBanner(existingCount: number): boolean {
  const n = Number.isFinite(existingCount) ? Math.trunc(existingCount) : 0;
  return n < MAX_HOME_BANNERS;
}

export function homeBannerLimitMessage(): string {
  return `Limite de ${MAX_HOME_BANNERS} banners na home. Edite ou exclua um existente.`;
}
