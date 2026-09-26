'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { splitBrl } from '@/lib/identidade';

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Below-the-fold reveal. Above-the-fold nodes are marked in before paint,
 * so the hero (and its LCP image, which must not sit inside this wrapper) stays still.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || reducedMotion()) return;
    const visible = () => {
      const rect = node.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
    };
    node.classList.add('is-armed');
    if (visible()) {
      node.classList.add('is-in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          node.classList.add('is-in');
          io.disconnect();
        }
      },
      { threshold: 0.18 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className ? `id-reveal ${className}` : 'id-reveal'}>
      {children}
    </div>
  );
}

/** Final amount on first paint. Count-up runs only when motion is allowed, and never on an image. */
export function PriceCount({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  useLayoutEffect(() => {
    if (reducedMotion()) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 680);
      const eased = 1 - (1 - t) * (1 - t);
      setShown(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setShown(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const parts = splitBrl(shown);
  return (
    <>
      <span className="id-cur">R$</span>
      <span className="id-whole id-num">{parts.whole}</span>
      <span className="id-cents">{parts.cents}</span>
    </>
  );
}
