import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export type MpOAuthStatePayload = {
  sellerId: string;
  nonce: string;
  exp: number;
};

function stateSecret(env: NodeJS.ProcessEnv = process.env): string {
  const dedicated = String(env.MP_OAUTH_STATE_SECRET || '').trim();
  if (dedicated) return dedicated;
  const jwt = String(env.JWT_ACCESS_SECRET || '').trim();
  if (jwt) return jwt;
  const err: Error & { code?: string } = new Error('Segredo de state OAuth ausente');
  err.code = 'MP_OAUTH_STATE_SECRET_MISSING';
  throw err;
}

export function signMpOAuthState(
  sellerId: string,
  ttlMs = 15 * 60 * 1000,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): string {
  const payload: MpOAuthStatePayload = {
    sellerId,
    nonce: randomBytes(16).toString('hex'),
    exp: now + ttlMs,
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', stateSecret(env)).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyMpOAuthState(
  state: string,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): MpOAuthStatePayload {
  const raw = String(state || '');
  const dot = raw.lastIndexOf('.');
  if (dot < 1) {
    const err: Error & { code?: string } = new Error('State OAuth inválido');
    err.code = 'MP_OAUTH_STATE_INVALID';
    throw err;
  }
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = createHmac('sha256', stateSecret(env)).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    const err: Error & { code?: string } = new Error('State OAuth inválido');
    err.code = 'MP_OAUTH_STATE_INVALID';
    throw err;
  }
  let payload: MpOAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as MpOAuthStatePayload;
  } catch {
    const err: Error & { code?: string } = new Error('State OAuth inválido');
    err.code = 'MP_OAUTH_STATE_INVALID';
    throw err;
  }
  if (!payload?.sellerId || !payload.nonce || !payload.exp) {
    const err: Error & { code?: string } = new Error('State OAuth inválido');
    err.code = 'MP_OAUTH_STATE_INVALID';
    throw err;
  }
  if (payload.exp < now) {
    const err: Error & { code?: string } = new Error('State OAuth expirado. Tente conectar de novo.');
    err.code = 'MP_OAUTH_STATE_EXPIRED';
    throw err;
  }
  return payload;
}
