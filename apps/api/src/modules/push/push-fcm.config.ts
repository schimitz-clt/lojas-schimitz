/**
 * Firebase Admin env presence — never log/return secret values.
 */

export const FIREBASE_ENV_KEYS = [
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'FIREBASE_SERVICE_ACCOUNT_BASE64',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'FIREBASE_PROJECT_ID',
] as const;

export type FirebaseAdminConfigResult = {
  configured: boolean;
  source: 'json' | 'base64' | 'adc_path' | null;
  projectId: string | null;
  reason: string;
};

function nonEmpty(env: NodeJS.ProcessEnv, key: string): string {
  return String(env[key] || '').trim();
}

function parseServiceAccount(raw: string): { ok: boolean; projectId: string | null } {
  try {
    const obj = JSON.parse(raw) as { project_id?: string; private_key?: string; client_email?: string };
    if (!obj || typeof obj !== 'object') return { ok: false, projectId: null };
    if (!String(obj.private_key || '').trim() || !String(obj.client_email || '').trim()) {
      return { ok: false, projectId: null };
    }
    return { ok: true, projectId: String(obj.project_id || '').trim() || null };
  } catch {
    return { ok: false, projectId: null };
  }
}

export function readFirebaseServiceAccountJson(env: NodeJS.ProcessEnv = process.env): string | null {
  const json = nonEmpty(env, 'FIREBASE_SERVICE_ACCOUNT_JSON');
  if (json) return json;
  const b64 = nonEmpty(env, 'FIREBASE_SERVICE_ACCOUNT_BASE64');
  if (b64) {
    try {
      return Buffer.from(b64, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }
  return null;
}

/** Presence + structural check. Does not initialize the Admin SDK. */
export function firebaseAdminConfiguredFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): FirebaseAdminConfigResult {
  const projectHint = nonEmpty(env, 'FIREBASE_PROJECT_ID') || null;
  const json = nonEmpty(env, 'FIREBASE_SERVICE_ACCOUNT_JSON');
  if (json) {
    const parsed = parseServiceAccount(json);
    if (!parsed.ok) {
      return {
        configured: false,
        source: null,
        projectId: projectHint,
        reason: 'json_invalid',
      };
    }
    return {
      configured: true,
      source: 'json',
      projectId: parsed.projectId || projectHint,
      reason: 'ok',
    };
  }
  const b64 = nonEmpty(env, 'FIREBASE_SERVICE_ACCOUNT_BASE64');
  if (b64) {
    let decoded = '';
    try {
      decoded = Buffer.from(b64, 'base64').toString('utf8');
    } catch {
      return { configured: false, source: null, projectId: projectHint, reason: 'base64_invalid' };
    }
    const parsed = parseServiceAccount(decoded);
    if (!parsed.ok) {
      return { configured: false, source: null, projectId: projectHint, reason: 'base64_json_invalid' };
    }
    return {
      configured: true,
      source: 'base64',
      projectId: parsed.projectId || projectHint,
      reason: 'ok',
    };
  }
  const adc = nonEmpty(env, 'GOOGLE_APPLICATION_CREDENTIALS');
  if (adc) {
    return {
      configured: true,
      source: 'adc_path',
      projectId: projectHint,
      reason: 'ok',
    };
  }
  return {
    configured: false,
    source: null,
    projectId: projectHint,
    reason: 'missing',
  };
}

export function firebaseConfiguredFromEnvPresence(env: NodeJS.ProcessEnv = process.env): boolean {
  return firebaseAdminConfiguredFromEnv(env).configured;
}
