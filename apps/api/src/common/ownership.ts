/**
 * Ownership / IDOR helpers (BOLA).
 * Cross-user access must look like "not found" (404) — never 403 that confirms existence.
 */

export const OWNERSHIP_CODES = {
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ADDRESS_NOT_FOUND: 'ADDRESS_NOT_FOUND',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
} as const;

export type OwnershipCode = (typeof OWNERSHIP_CODES)[keyof typeof OWNERSHIP_CODES];

/** Same owner when both ids are non-empty and equal. */
export function sameOwner(actorUserId: string | null | undefined, resourceUserId: string | null | undefined): boolean {
  const a = typeof actorUserId === 'string' ? actorUserId.trim() : '';
  const b = typeof resourceUserId === 'string' ? resourceUserId.trim() : '';
  if (!a || !b) return false;
  return a === b;
}

/**
 * Deny when resource is missing OR belongs to another user.
 * Callers throw NotFoundException with the returned payload.
 */
export function denyIfNotOwner(
  actorUserId: string,
  resourceUserId: string | null | undefined,
  code: OwnershipCode,
  message: string,
): { ok: true } | { ok: false; code: OwnershipCode; message: string } {
  if (!sameOwner(actorUserId, resourceUserId)) {
    return { ok: false, code, message };
  }
  return { ok: true };
}

/** Admin role gate (JWT user.role from DB via JwtAuthGuard). */
export function isAdminRole(role: string | null | undefined): boolean {
  return String(role || '').toLowerCase() === 'admin';
}

/** Fields allowed on PATCH /me — role/email/status must never be writable here. */
export const ME_PATCH_ALLOWED_KEYS = ['name', 'phone'] as const;

export function filterMePatchKeys(input: Record<string, unknown>): {
  allowed: Partial<Record<(typeof ME_PATCH_ALLOWED_KEYS)[number], unknown>>;
  rejected: string[];
} {
  const allowed: Partial<Record<(typeof ME_PATCH_ALLOWED_KEYS)[number], unknown>> = {};
  const rejected: string[] = [];
  for (const [k, v] of Object.entries(input || {})) {
    if ((ME_PATCH_ALLOWED_KEYS as readonly string[]).includes(k)) {
      (allowed as Record<string, unknown>)[k] = v;
    } else {
      rejected.push(k);
    }
  }
  return { allowed, rejected };
}
