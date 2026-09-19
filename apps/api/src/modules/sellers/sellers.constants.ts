/** Deterministic default storefront seller (migration + runtime fallback). */
export const DEFAULT_SELLER_ID = '00000000-0000-4000-8000-000000000001';
export const DEFAULT_SELLER_SLUG = 'lojas-schimitz';
export const DEFAULT_SELLER_NAME = 'Lojas Schimitz';

export const SELLER_STATUSES = ['pending', 'active', 'suspended'] as const;
export type SellerStatusValue = (typeof SELLER_STATUSES)[number];

export function publicSellerShape(s: { id: string; name: string; slug: string }) {
  return { id: s.id, name: s.name, slug: s.slug };
}

/** Public catalog / directory: only active sellers are visible. */
export function isPublicSellerVisible(status?: string | null): boolean {
  return status === 'active';
}

/** Directory card: no owner email, commission, or status. */
export function publicSellerListItem(s: {
  id: string;
  name: string;
  slug: string;
  productCount?: number;
}) {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    productCount: s.productCount ?? 0,
  };
}

export function canSetSellerStatus(from: string, to: string): boolean {
  if (!(SELLER_STATUSES as readonly string[]).includes(to)) return false;
  if (from === to) return true;
  // pending → active|suspended; active ↔ suspended; suspended → active
  if (from === 'pending') return to === 'active' || to === 'suspended';
  if (from === 'active') return to === 'suspended' || to === 'pending';
  if (from === 'suspended') return to === 'active' || to === 'pending';
  return false;
}

export function slugifySellerName(name: string) {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'seller'
  );
}
