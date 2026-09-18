'use client';

import { useEffect, useState } from 'react';
import { currentUser, ensureHydratedSession, SESSION_UPDATED_EVENT, type SessionUser } from '@/lib/api';

/**
 * Cookie-first session for chrome / Conta / checkout.
 * Waits for HttpOnly refresh restore before treating missing `sch_user` as guest.
 */
export function useSessionUser(): { user: SessionUser | null; ready: boolean } {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void ensureHydratedSession().then((next) => {
      if (cancelled) return;
      setUser(next);
      setReady(true);
    });
    const onUp = () => {
      setUser(currentUser());
    };
    window.addEventListener(SESSION_UPDATED_EVENT, onUp);
    return () => {
      cancelled = true;
      window.removeEventListener(SESSION_UPDATED_EVENT, onUp);
    };
  }, []);

  return { user, ready };
}
