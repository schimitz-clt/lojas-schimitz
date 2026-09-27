'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/client-error-report';

/** H4 — captures uncaught browser errors / unhandled promise rejections (no UI). */
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => {
      reportClientError('onerror', ev.error ?? ev.message, {
        source: ev.filename,
        line: ev.lineno,
        column: ev.colno,
      });
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      reportClientError('unhandledrejection', ev.reason);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
