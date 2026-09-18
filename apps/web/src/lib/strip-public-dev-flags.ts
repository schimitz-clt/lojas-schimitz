/**
 * Dev-only NEXT_PUBLIC_* flags that must never reach a production Next bundle.
 *
 * `next build` inlines every referenced NEXT_PUBLIC_* value. A stray
 * NEXT_PUBLIC_NULL_WEBHOOK_SECRET on the Railway **web** service would otherwise
 * leak into homepage/order chunks. Production builds delete these keys before
 * webpack DefinePlugin runs (see next.config.ts).
 */

export const PUBLIC_DEV_ONLY_ENV_KEYS = [
  'NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE',
  'NEXT_PUBLIC_NULL_WEBHOOK_SECRET',
] as const;

export type PublicDevOnlyEnvKey = (typeof PUBLIC_DEV_ONLY_ENV_KEYS)[number];

export type EnvBag = Record<string, string | undefined>;

export function isNextProductionBuild(env: EnvBag = process.env): boolean {
  return String(env.NODE_ENV || '').toLowerCase() === 'production';
}

/**
 * Mutates `env`: in production builds, deletes the listed keys.
 * Returns the names that had a non-empty value (for build logs — never the values).
 */
export function stripPublicDevOnlyFlags(env: EnvBag = process.env): PublicDevOnlyEnvKey[] {
  if (!isNextProductionBuild(env)) return [];
  const stripped: PublicDevOnlyEnvKey[] = [];
  for (const key of PUBLIC_DEV_ONLY_ENV_KEYS) {
    const raw = env[key];
    if (raw != null && String(raw).length > 0) stripped.push(key);
    delete env[key];
  }
  return stripped;
}
