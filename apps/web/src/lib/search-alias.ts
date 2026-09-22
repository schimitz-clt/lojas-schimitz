/**
 * Customer search aliases. Preserves the query string, including ?q=.
 */

const SEARCH_ALIAS_PATHS = new Set(['/busca', '/buscar']);

function normalizePath(pathname: string | undefined): string {
  const raw = pathname || '';
  if (raw.length > 1 && raw.endsWith('/')) return raw.replace(/\/+$/, '');
  return raw;
}

/** Rebuild a query string from App Router searchParams, preserving repeated keys. */
export function searchParamsToQuery(sp: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') params.append(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    }
  }
  const q = params.toString();
  return q ? `?${q}` : '';
}

/** Destination path + original query, or null when this is not a search alias. */
export function catalogSearchAliasDestination(input: {
  pathname?: string;
  search?: string;
}): string | null {
  if (!SEARCH_ALIAS_PATHS.has(normalizePath(input.pathname))) return null;
  const search = input.search
    ? input.search.startsWith('?')
      ? input.search
      : `?${input.search}`
    : '';
  return `/produtos${search}`;
}
