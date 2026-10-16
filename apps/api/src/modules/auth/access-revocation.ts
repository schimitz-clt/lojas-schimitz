/**
 * Achado 7c: access JWT (15 min) deixava de valer só quando expirava, mesmo após logout.
 * Agora todo access emitido leva `jti`; no logout esse `jti` entra na denylist (RevokedAccessToken)
 * e os guards recusam. Tokens antigos sem `jti` (emitidos antes deste deploy) seguem o TTL normal.
 */
export type RevocationStore = {
  revokedAccessToken: {
    findUnique(args: { where: { jti: string }; select?: { jti: true } }): Promise<{ jti: string } | null>;
    createMany(args: { data: Array<{ jti: string; userId: string; expiresAt: Date }>; skipDuplicates?: boolean }): Promise<unknown>;
  };
};

export async function isAccessTokenRevoked(store: RevocationStore, jti: unknown): Promise<boolean> {
  if (typeof jti !== 'string' || !jti) return false;
  const row = await store.revokedAccessToken.findUnique({ where: { jti }, select: { jti: true } });
  return Boolean(row);
}

/** Registra o access como revogado até o `exp` dele. Idempotente. */
export async function revokeAccessToken(
  store: RevocationStore,
  payload: { jti?: unknown; sub?: unknown; exp?: unknown },
): Promise<boolean> {
  const jti = typeof payload?.jti === 'string' ? payload.jti : '';
  const sub = typeof payload?.sub === 'string' ? payload.sub : '';
  if (!jti || !sub) return false;
  const exp = typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp * 1000 : Date.now() + 60 * 60 * 1000;
  await store.revokedAccessToken.createMany({ data: [{ jti, userId: sub, expiresAt: new Date(exp) }], skipDuplicates: true });
  return true;
}
