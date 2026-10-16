/** Mirror of API gate — Admin UI calls server when this is true. */
export function isPublicIdLike(q: string): boolean {
  return /^sch[-_]?/i.test((q || '').trim());
}

export function shouldServerOrderSearch(q?: string): boolean {
  const term = (q || '').trim();
  if (!term) return false;
  if (isPublicIdLike(term)) return true;
  return term.length >= 3;
}

/** Build GET /admin/orders query string (status + optional q). */
export function buildAdminOrdersQueryPath(opts: {
  status?: string;
  q?: string;
  /** ativos (padrão, omitido) | encerrados | arquivados */
  view?: string;
}): string {
  const qs = new URLSearchParams();
  if (opts.status) qs.set('status', opts.status);
  if (opts.view && opts.view !== 'ativos') qs.set('view', opts.view);
  const q = (opts.q || '').trim();
  if (shouldServerOrderSearch(q)) qs.set('q', q);
  const s = qs.toString();
  return s ? `/admin/orders?${s}` : '/admin/orders';
}
