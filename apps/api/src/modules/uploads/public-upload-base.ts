/**
 * Build the public URL stored for a new upload.
 *
 * Prefers the storefront origin (SITE_URL → APP_URL → NEXT_PUBLIC_SITE_URL
 * → PUBLIC_WEB_URL) so the saved URL is the apex proxy
 * (https://lojasschimitz.com.br/api/v1/uploads/...), which already rewrites
 * Railway. Falls back to PUBLIC_API_URL / request host (existing behavior).
 *
 * www.lojasschimitz.com.br is normalized to apex (www still 404s at the edge).
 */

import { PUBLIC_UPLOAD_ORIGIN, RAILWAY_UPLOAD_HOST } from '../../common/public-upload-url';

function sanitizeOrigin(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/\/$/, '');
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return null;
  s = s.replace(/\/api\/v1$/i, '');
  try {
    const u = new URL(s.includes('://') ? s : `https://${s}`);
    const host = (u.hostname || '').toLowerCase();
    if (!host || host === 'null' || host === 'undefined') return null;
    if (host === 'www.lojasschimitz.com.br') return PUBLIC_UPLOAD_ORIGIN;
    return `${u.protocol}//${u.host}`.replace(/\/$/, '');
  } catch {
    return null;
  }
}

function isLocalHost(origin: string): boolean {
  const lower = origin.toLowerCase();
  return (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('[::1]') ||
    lower.includes('://[::1]')
  );
}

function isRailwayApiHost(origin: string): boolean {
  try {
    return new URL(origin).hostname.toLowerCase() === RAILWAY_UPLOAD_HOST;
  } catch {
    return false;
  }
}

/**
 * Public site origin for NEW upload URLs, or null to fall back to PUBLIC_API_URL.
 * Production skips localhost. Railway hosts in SITE_URL/APP_URL are skipped
 * (those belong in PUBLIC_API_URL).
 */
export function resolvePublicUploadOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const isProd = (env.NODE_ENV || env.APP_ENV || '').toLowerCase() === 'production';
  const candidates = [env.SITE_URL, env.APP_URL, env.NEXT_PUBLIC_SITE_URL, env.PUBLIC_WEB_URL];
  for (const raw of candidates) {
    const origin = sanitizeOrigin(raw);
    if (!origin) continue;
    if (isProd && isLocalHost(origin)) continue;
    if (isRailwayApiHost(origin)) continue;
    return origin;
  }
  return null;
}

export function safeUploadFilename(filename: string): string {
  const base = String(filename || '').replace(/\\/g, '/').split('/').pop() || '';
  return base.includes('..') ? '' : base;
}

/** Absolute public URL for a stored file under /{prefix}/uploads/{filename}. */
export function buildPublicUploadUrl(
  filename: string,
  env: NodeJS.ProcessEnv = process.env,
  req?: {
    protocol?: string;
    headers?: Record<string, unknown>;
    get?: (h: string) => string | undefined;
  },
): string {
  const prefix = (env.API_PREFIX || 'api/v1').replace(/^\/|\/$/g, '');
  const safeName = safeUploadFilename(filename) || 'file.bin';

  const siteOrigin = resolvePublicUploadOrigin(env);
  if (siteOrigin) {
    return `${siteOrigin}/${prefix}/uploads/${safeName}`;
  }

  const envBase = (env.PUBLIC_API_URL || env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
  if (envBase) {
    return `${envBase}/uploads/${safeName}`;
  }

  const headers = req?.headers || {};
  const xfProto = String(headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const xfHost = String(headers['x-forwarded-host'] || '').split(',')[0].trim();
  const proto = xfProto || req?.protocol || 'http';
  const host = xfHost || req?.get?.('host') || 'localhost:3001';
  return `${proto}://${host}/${prefix}/uploads/${safeName}`;
}
