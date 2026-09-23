/**
 * Client navigations should not sit on the previous page with no feedback.
 * Helpers are DOM-free so the click rules can be unit-tested.
 */

export const NAV_PROGRESS_EVENT = 'sch-nav-progress';

/** Same-origin app path (pathname + search + hash), or null for external / non-nav hrefs. */
export function internalAppPath(href: string, baseOrigin: string): string | null {
  const raw = href.trim();
  if (!raw || raw.startsWith('#') || /^(?:mailto:|tel:|javascript:)/i.test(raw)) return null;
  let url: URL;
  let base: URL;
  try {
    base = new URL(baseOrigin);
    url = new URL(raw, base);
  } catch {
    return null;
  }
  if (url.origin !== base.origin) return null;
  if (url.pathname.startsWith('/admin')) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export type NavigationClick = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
};

export function shouldStartNavigationProgress(input: {
  click: NavigationClick;
  href: string | null;
  target: string | null;
  download: boolean;
  current: { pathname: string; search: string; hash: string; origin: string };
}): boolean {
  const click = input.click;
  if (click.defaultPrevented || click.button !== 0) return false;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if (input.download) return false;
  const target = (input.target || '').trim().toLowerCase();
  if (target && target !== '_self') return false;
  if (!input.href) return false;
  const next = internalAppPath(input.href, input.current.origin);
  if (!next) return false;
  const here = `${input.current.pathname}${input.current.search}${input.current.hash}`;
  if (next === here) return false;
  const nextUrl = new URL(next, input.current.origin);
  if (
    nextUrl.pathname === input.current.pathname &&
    nextUrl.search === input.current.search
  ) {
    return false;
  }
  return true;
}

/** Ask the storefront progress bar to arm. No-op without a browser (and on /admin). */
export function requestNavigationProgress() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NAV_PROGRESS_EVENT));
}

/**
 * Run after the new route has painted. Idle when the browser supports it,
 * otherwise the next macrotask — never blocks the transition commit.
 */
export function scheduleAfterFirstPaint(run: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(() => run(), { timeout: 1200 });
    return () => w.cancelIdleCallback?.(id);
  }
  const timer = window.setTimeout(run, 1);
  return () => window.clearTimeout(timer);
}
