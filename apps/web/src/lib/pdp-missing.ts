/**
 * Unknown PDP slugs. Callers must notFound() — never treat the slug as a product name.
 */

export function isMissingPdp(meta: unknown, product: unknown): boolean {
  if (meta == null || product == null) return true;
  if (typeof product !== 'object') return true;
  const slug = (product as { slug?: unknown }).slug;
  return typeof slug !== 'string' || !slug.trim();
}

/** Breadcrumb label from the catalog name. Never falls back to the raw slug. */
export function pdpBreadcrumbName(productName: string | null | undefined): string {
  const name = typeof productName === 'string' ? productName.trim() : '';
  return name || 'Produto';
}
