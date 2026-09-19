/**
 * AES-256-GCM envelope for SellerMpCredential tokens.
 *
 * Key: MP_SELLER_CREDENTIAL_KEY — 32-byte hex (64 chars) or standard base64.
 * Ciphertext format: v1.<iv_b64url>.<tag_b64url>.<ct_b64url>
 *
 * Matches the repo secret pattern: env-held key, never logged, never returned on APIs.
 * Tokens stay in SellerMpCredential; Phase 1 createIntent must not decrypt them for charges.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const PREFIX = 'v1';

export class CredentialKeyMissingError extends Error {
  readonly code = 'MP_CREDENTIAL_KEY_MISSING';
  constructor() {
    super(
      'MP_SELLER_CREDENTIAL_KEY não configurada. Use 32 bytes em hex (64 chars) ou base64. Necessária para guardar tokens OAuth do vendedor.',
    );
    this.name = 'CredentialKeyMissingError';
  }
}

export function parseCredentialKey(raw: string): Buffer {
  const s = String(raw || '').trim();
  if (!s) throw new CredentialKeyMissingError();
  if (/^[0-9a-fA-F]{64}$/.test(s)) {
    return Buffer.from(s, 'hex');
  }
  try {
    const buf = Buffer.from(s, 'base64');
    if (buf.length === 32) return buf;
  } catch {
    /* fall through */
  }
  const err: Error & { code?: string } = new Error(
    'MP_SELLER_CREDENTIAL_KEY inválida (esperado 32 bytes hex ou base64).',
  );
  err.code = 'MP_CREDENTIAL_KEY_INVALID';
  throw err;
}

export function resolveCredentialKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  return parseCredentialKey(env.MP_SELLER_CREDENTIAL_KEY || '');
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join(
    '.',
  );
}

export function decryptSecret(envelope: string, key: Buffer): string {
  const parts = String(envelope || '').split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error('Envelope de credencial inválido');
  }
  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(parts[2], 'base64url');
  const ct = Buffer.from(parts[3], 'base64url');
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
