'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { UTM_STORAGE_KEY, mergeUtm, utmFromSearch, utmHasValues, type StoredUtm } from '@/lib/marketing';

export function readStoredUtm(): StoredUtm {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredUtm;
    return utmFromSearch(
      new URLSearchParams(
        [
          parsed.utmSource ? `utm_source=${encodeURIComponent(parsed.utmSource)}` : '',
          parsed.utmMedium ? `utm_medium=${encodeURIComponent(parsed.utmMedium)}` : '',
          parsed.utmCampaign ? `utm_campaign=${encodeURIComponent(parsed.utmCampaign)}` : '',
          parsed.utmContent ? `utm_content=${encodeURIComponent(parsed.utmContent)}` : '',
          parsed.utmTerm ? `utm_term=${encodeURIComponent(parsed.utmTerm)}` : '',
        ]
          .filter(Boolean)
          .join('&'),
      ),
    );
  } catch {
    return {};
  }
}

/** Keeps the first landing UTM through later pages until checkout creates the order. */
export function UtmCapture() {
  const search = useSearchParams();
  useEffect(() => {
    const next = utmFromSearch(search?.toString() || '');
    if (!utmHasValues(next)) return;
    try {
      const merged = mergeUtm(readStoredUtm(), next);
      window.sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      /* private mode */
    }
  }, [search]);
  return null;
}
