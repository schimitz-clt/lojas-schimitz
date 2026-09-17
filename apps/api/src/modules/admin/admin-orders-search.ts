import { Prisma, OrderStatus } from '@prisma/client';

/** Cap for GET /admin/orders?q= — never dump unbounded history. */
export const ADMIN_ORDER_SEARCH_TAKE_MAX = 50;
export const ADMIN_ORDER_SEARCH_TAKE_DEFAULT = 50;
/** Default list without q keeps historical take:100 behaviour. */
export const ADMIN_ORDER_LIST_TAKE = 100;

/** SCH-… publicId prefix (case-insensitive). */
export function isPublicIdLike(q: string): boolean {
  return /^sch[-_]?/i.test((q || '').trim());
}

/**
 * Server search gate: length >= 3 OR publicId-like SCH-.
 * Shorter terms stay client-side on the loaded window (no global dump).
 */
export function shouldServerOrderSearch(q?: string): boolean {
  const term = (q || '').trim();
  if (!term) return false;
  if (isPublicIdLike(term)) return true;
  return term.length >= 3;
}

export function clampOrderSearchTake(
  take?: number,
  max = ADMIN_ORDER_SEARCH_TAKE_MAX,
  fallback = ADMIN_ORDER_SEARCH_TAKE_DEFAULT,
): number {
  const n = Number(take);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export type AdminOrderStatusWhere = {
  status?: OrderStatus | { in: OrderStatus[] };
};

/**
 * Pure Prisma where for admin order list/search.
 * Single-store: no tenant scope needed; never widens beyond status + search OR.
 */
export function buildAdminOrderWhere(
  q?: string,
  statusWhere?: AdminOrderStatusWhere,
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (statusWhere?.status != null) {
    where.status = statusWhere.status;
  }

  const term = (q || '').trim();
  if (!shouldServerOrderSearch(term)) {
    return where;
  }

  const or: Prisma.OrderWhereInput[] = [
    { publicId: { startsWith: term, mode: 'insensitive' } },
    { user: { email: { contains: term, mode: 'insensitive' } } },
    { user: { name: { contains: term, mode: 'insensitive' } } },
  ];

  // Exact internal id when term looks like a UUID.
  if (/^[0-9a-f]{8}-[0-9a-f-]{4,}$/i.test(term) || /^[0-9a-f]{32}$/i.test(term)) {
    or.push({ id: term });
  }

  where.OR = or;
  return where;
}

/** take for findMany: search → capped 50; plain list → 100. */
export function resolveAdminOrdersTake(q?: string, take?: number): number {
  if (shouldServerOrderSearch(q)) {
    return clampOrderSearchTake(take);
  }
  return ADMIN_ORDER_LIST_TAKE;
}
