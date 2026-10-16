type Win = { matchMedia?: (q: string) => { matches: boolean } } | null;

/** Sem autoplay quando o sistema pede movimento reduzido (ou sem window: servidor). */
export function shouldSkipBannerAutoplay(win: Win): boolean {
  if (!win || typeof win.matchMedia !== 'function') return true;
  return win.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
