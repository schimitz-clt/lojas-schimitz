/**
 * Search chrome pinning.
 * The yellow promo, black header, and address row stay one stack.
 * On results — and while the suggestion panel is open — that stack is fixed
 * so a keyboard or a second sticky bar cannot push it down the page.
 */

export const SEARCH_OPEN_CLASS = 'search-open';
export const SEARCH_RESULTS_CLASS = 'search-results';

/** Visual-viewport offset (keyboard). 0 when the layout and the visible area match. */
export function chromeVisualTop(offsetTop: number | null | undefined): number {
  const n = typeof offsetTop === 'number' ? offsetTop : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

export function chromeStackHeight(height: number | null | undefined): number {
  const n = typeof height === 'number' ? height : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

/**
 * Catalog filter bars stick under the chrome.
 * Sharing top: 0 with the header lets the later sticky push the search bar
 * downward on scroll-up and leave it there.
 */
export function filterBarStickyTop(chromeHeightPx: number): string {
  return `${chromeStackHeight(chromeHeightPx)}px`;
}

/** Fixed chrome while suggestions are open or the keyboard has shifted the viewport. */
export function shouldPinSearchChrome(input: { searchOpen: boolean; searchResults: boolean }): boolean {
  return Boolean(input.searchOpen || input.searchResults);
}
