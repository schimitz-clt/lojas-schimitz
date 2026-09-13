/**
 * Soft-merge redirects for deactivated duplicate product slugs.
 * Keep historical rows; never invent products. Map old slug → active canonical.
 */
export const PRODUCT_SLUG_REDIRECTS: Readonly<Record<string, string>> = {
  /** Empty duplicate soft-disabled; photo+stock live on -2 */
  'ar-condicionado-aiwa': 'ar-condicionado-aiwa-2',
};

export function resolveProductSlugRedirect(slug: string): string | null {
  const key = (slug || '').trim().toLowerCase();
  if (!key) return null;
  const target = PRODUCT_SLUG_REDIRECTS[key];
  if (!target || target === key) return null;
  return target;
}
