/**
 * Shared prod-like detection (error filter, Swagger, payments).
 *
 * Fail-closed: Railway production/staging counts even if APP_ENV is mis-set.
 * NODE_ENV is checked independently of APP_ENV (a stray APP_ENV=development on
 * a production process must not re-enable simulate / leak 500 details).
 */

export type EnvLike = Record<string, string | undefined>;

const PROD_LIKE_VALUES = new Set(['production', 'prod', 'staging']);

function flag(value: string | undefined): string {
  return String(value || '').toLowerCase().trim();
}

export function isProdLikeEnv(env: EnvLike = process.env): boolean {
  if (PROD_LIKE_VALUES.has(flag(env.APP_ENV))) return true;
  if (PROD_LIKE_VALUES.has(flag(env.NODE_ENV))) return true;
  if (PROD_LIKE_VALUES.has(flag(env.RAILWAY_ENVIRONMENT))) return true;
  if (PROD_LIKE_VALUES.has(flag(env.RAILWAY_ENVIRONMENT_NAME))) return true;
  return false;
}

/** Alias used by Swagger / exception filter. */
export const isProdLikeAppEnv = isProdLikeEnv;
