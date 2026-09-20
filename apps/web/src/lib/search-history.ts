/**
 * Recent header-search terms (device localStorage). No login, no API.
 * Terms only — never invent products. Pure helpers + thin storage I/O.
 */

import { SEARCH_SUGGEST_MIN, normalizeSearchQuery } from '@/lib/search-suggestions';

export const SEARCH_HISTORY_MAX = 8;
export const SEARCH_HISTORY_STORAGE_KEY = 'sch_search_q_v1';
export const SEARCH_HISTORY_EVENT = 'sch-search-history-updated';

export function searchHistoryHeading(): string {
  return 'Você buscou';
}

export function searchHistoryClearLabel(): string {
  return 'Limpar';
}

/** Trim, collapse whitespace, cap length. Empty if too short to search. */
export function normalizeHistoryTerm(q: string | null | undefined): string {
  const term = (q || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (normalizeSearchQuery(term).length < SEARCH_SUGGEST_MIN) return '';
  return term;
}

export function parseSearchHistory(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    const term = normalizeHistoryTerm(typeof item === 'string' ? item : '');
    if (!term) continue;
    const key = normalizeSearchQuery(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= SEARCH_HISTORY_MAX) break;
  }
  return out;
}

/** Newest first. Drops older case/accent duplicates. */
export function rememberSearchTerm(list: string[], q: string | null | undefined): string[] {
  const term = normalizeHistoryTerm(q);
  if (!term) return parseSearchHistory(list);
  const key = normalizeSearchQuery(term);
  const rest = parseSearchHistory(list).filter((x) => normalizeSearchQuery(x) !== key);
  return parseSearchHistory([term, ...rest]);
}

export function shouldShowSearchHistory(q: string | null | undefined, count: number): boolean {
  if (count <= 0) return false;
  return !(q || '').trim();
}

export function readSearchHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    return parseSearchHistory(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeSearchHistory(list: string[]): string[] {
  const next = parseSearchHistory(list);
  if (typeof window === 'undefined') return next;
  try {
    window.localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  try {
    window.dispatchEvent(new Event(SEARCH_HISTORY_EVENT));
  } catch {
    /* ignore */
  }
  return next;
}

export function persistSearchTerm(q: string | null | undefined): string[] {
  return writeSearchHistory(rememberSearchTerm(readSearchHistory(), q));
}

export function clearSearchHistory(): string[] {
  return writeSearchHistory([]);
}
