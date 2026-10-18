'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useRef } from 'react';
import type { PrefetchOptions } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
 * Product links are dynamic routes: the in-view prefetch only brings the loading skeleton.
 * On finger-down we ask for the FULL route (data included), so by the time the tap
 * becomes a click (~100 ms later, longer in the Android WebView) the PDP is already
 * on its way. One request per card per page view, only for cards the person touches.
 */
export const FULL_PREFETCH = { kind: 'full' } as unknown as PrefetchOptions;

export function usePrefetchFullOnTouch(href: string) {
  const router = useRouter();
  const done = useRef<string | null>(null);
  return useCallback(() => {
    if (done.current === href) return;
    done.current = href;
    try {
      router.prefetch(href, FULL_PREFETCH);
    } catch {
      /* prefetch is best-effort */
    }
  }, [href, router]);
}
