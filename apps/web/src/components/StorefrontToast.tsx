'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  STOREFRONT_TOAST_EVENT,
  parseToastPayload,
  type StorefrontToastPayload,
} from '@/lib/storefront-toast';

export function StorefrontToast() {
  const [toast, setToast] = useState<StorefrontToastPayload | null>(null);

  useEffect(() => {
    function onToast(ev: Event) {
      const detail = 'detail' in ev ? (ev as CustomEvent).detail : null;
      const next = parseToastPayload(detail);
      setToast(next);
    }
    window.addEventListener(STOREFRONT_TOAST_EVENT, onToast);
    return () => window.removeEventListener(STOREFRONT_TOAST_EVENT, onToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      className={`sf-toast${toast.tone === 'warn' ? ' sf-toast-warn' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span>{toast.message}</span>
      {toast.href && toast.hrefLabel ? (
        <Link className="btn" href={toast.href} onClick={() => setToast(null)}>
          {toast.hrefLabel}
        </Link>
      ) : null}
      <button
        type="button"
        className="sf-toast-x"
        aria-label="Fechar"
        onClick={() => setToast(null)}
      >
        ×
      </button>
    </div>
  );
}
