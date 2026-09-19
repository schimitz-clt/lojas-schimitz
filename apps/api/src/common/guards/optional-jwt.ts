/**
 * Optional JWT attach — cart / chat.
 * Invalid, missing, or inactive users become guest (no req.user).
 * Never elevates a blocked account.
 */

export type OptionalJwtPayload = {
  sub?: string;
  email?: string;
  role?: string;
  status?: string;
  [key: string]: unknown;
};

export type OptionalJwtUserRow = {
  id: string;
  email: string;
  role: string;
  status: string;
};

export async function resolveOptionalAccessUser(input: {
  token: string;
  verify: (token: string) => Promise<OptionalJwtPayload>;
  lookupUser: (id: string) => Promise<OptionalJwtUserRow | null>;
}): Promise<(OptionalJwtPayload & { sub: string; email: string; role: string; status: string }) | null> {
  const token = String(input.token || '').trim();
  if (!token) return null;
  try {
    const payload = await input.verify(token);
    const sub = typeof payload?.sub === 'string' ? payload.sub : '';
    if (!sub) return null;
    const user = await input.lookupUser(sub);
    if (!user || user.status !== 'active') return null;
    return {
      ...payload,
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  } catch {
    return null;
  }
}
