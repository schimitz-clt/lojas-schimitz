'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  NAV_PROGRESS_EVENT,
  shouldStartNavigationProgress,
} from '@/lib/navigation-progress';

const SHOW_DELAY_MS = 80;
const DONE_MS = 220;
const FAILSAFE_MS = 8000;

/**
 * Thin top bar. Stays hidden for instant transitions (under SHOW_DELAY_MS)
 * and creeps while a dynamic route is still on the server, so the header
 * does not feel frozen. Transform/opacity only.
 */
export function NavigationProgress() {
  const pathname = usePathname() || '/';
  const [phase, setPhase] = useState<'idle' | 'active' | 'done'>('idle');
  const pending = useRef(false);
  const startUrl = useRef('');
  const showTimer = useRef(0);
  const failTimer = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    function finish() {
      pending.current = false;
      window.clearTimeout(showTimer.current);
      window.clearTimeout(failTimer.current);
      cancelAnimationFrame(raf.current);
      setPhase((cur) => (cur === 'active' ? 'done' : 'idle'));
    }

    function watch() {
      if (!pending.current) return;
      const now = `${window.location.pathname}${window.location.search}`;
      if (now !== startUrl.current) {
        finish();
        return;
      }
      raf.current = requestAnimationFrame(watch);
    }

    function begin() {
      pending.current = true;
      startUrl.current = `${window.location.pathname}${window.location.search}`;
      window.clearTimeout(showTimer.current);
      window.clearTimeout(failTimer.current);
      cancelAnimationFrame(raf.current);
      showTimer.current = window.setTimeout(() => {
        if (!pending.current) return;
        const now = `${window.location.pathname}${window.location.search}`;
        if (now !== startUrl.current) {
          pending.current = false;
          return;
        }
        setPhase('active');
        raf.current = requestAnimationFrame(watch);
      }, SHOW_DELAY_MS);
      failTimer.current = window.setTimeout(() => {
        pending.current = false;
        setPhase('idle');
      }, FAILSAFE_MS);
    }

    function onClick(event: MouseEvent) {
      const el = event.target;
      if (!(el instanceof Element)) return;
      const anchor = el.closest('a');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const ok = shouldStartNavigationProgress({
        click: {
          button: event.button,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          defaultPrevented: event.defaultPrevented,
        },
        href: anchor.getAttribute('href'),
        target: anchor.getAttribute('target'),
        download: anchor.hasAttribute('download'),
        current: {
          pathname: window.location.pathname,
          search: window.location.search,
          hash: window.location.hash,
          origin: window.location.origin,
        },
      });
      if (!ok) return;
      begin();
    }

    document.addEventListener('click', onClick, true);
    window.addEventListener(NAV_PROGRESS_EVENT, begin);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener(NAV_PROGRESS_EVENT, begin);
      window.clearTimeout(showTimer.current);
      window.clearTimeout(failTimer.current);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'done') return;
    const t = window.setTimeout(() => setPhase('idle'), DONE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    window.clearTimeout(showTimer.current);
    window.clearTimeout(failTimer.current);
    setPhase((cur) => (cur === 'active' ? 'done' : 'idle'));
  }, [pathname]);

  return (
    <div
      className={`nav-progress${phase === 'active' ? ' is-active' : ''}${phase === 'done' ? ' is-done' : ''}`}
      aria-hidden="true"
    />
  );
}
