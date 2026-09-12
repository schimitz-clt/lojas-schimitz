/**
 * Pure in-app notification dedupe helpers (Phase 15).
 * No DB / Nest deps — unit-testable.
 */

/** Types that must not spam the same user for the same order (or user-only for welcome). */
export const IN_APP_DEDUPE_TYPES = [
  'order_paid',
  'order_cancelled',
  'order_created',
  'payment_refused',
  'order_status',
  'welcome',
] as const;

export type InAppDedupeType = (typeof IN_APP_DEDUPE_TYPES)[number];

export function isInAppDedupeType(type: string): type is InAppDedupeType {
  return (IN_APP_DEDUPE_TYPES as readonly string[]).includes(type);
}

/**
 * Build Prisma-like where clause for duplicate skip.
 * - welcome: userId + type (no order)
 * - order_status: userId + orderId + type + title (title encodes status label)
 * - others with orderId: userId + orderId + type
 * Returns null when dedupe does not apply.
 */
export function buildInAppDedupeWhere(input: {
  userId: string;
  type: string;
  title?: string;
  orderId?: string | null;
}): { userId: string; type: string; orderId?: string; title?: string } | null {
  if (!isInAppDedupeType(input.type)) return null;
  if (input.type === 'welcome') {
    return { userId: input.userId, type: 'welcome' };
  }
  const orderId = (input.orderId || '').trim();
  if (!orderId) return null;
  if (input.type === 'order_status') {
    const title = String(input.title || '').trim();
    if (!title) return null;
    return { userId: input.userId, type: 'order_status', orderId, title };
  }
  return { userId: input.userId, type: input.type, orderId };
}

/** Stable key for tests / logging (no email / no secrets). */
export function inAppDedupeKey(where: {
  userId: string;
  type: string;
  orderId?: string;
  title?: string;
}): string {
  const parts = [where.type, where.userId];
  if (where.orderId) parts.push(where.orderId);
  if (where.title) parts.push(where.title);
  return parts.join(':');
}
