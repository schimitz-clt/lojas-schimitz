'use client';

import { useEffect, type ReactNode } from 'react';
import { ensureHydratedSession } from '@/lib/api';

/** Kick cookie restore on every route (incl. /admin) before Conta/checkout gates. */
export function SessionHydrator({ children }: { children: ReactNode }) {
  useEffect(() => {
    void ensureHydratedSession();
  }, []);
  return children;
}
