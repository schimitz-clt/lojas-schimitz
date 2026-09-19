/**
 * Mercado Pago marketplace split flags.
 *
 * ENABLED: OAuth UI + credential storage + refresh job + Phase 2 sandbox path
 *   (only together with ALLOW_LIVE=false and sandbox-eligible credentials:
 *   TEST- always, or APP_USR from MP credenciais de teste on staging / non-prod).
 * ALLOW_LIVE: reserved for Phase 3. Phase 2 reads it only to KEEP IT FALSE —
 *   true never sends application_fee / seller token (fail-closed).
 * Default for both: false (unset / empty / anything except explicit true).
 */

function envFlagTrue(name: string): boolean {
  const raw = String(process.env[name] || '')
    .toLowerCase()
    .trim();
  return raw === 'true' || raw === '1' || raw === 'on';
}

/** OAuth connect UI + refresh job + sandbox split gate (with extra credential checks). */
export function isMarketplaceSplitEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(env.MP_MARKETPLACE_SPLIT_ENABLED || '')
    .toLowerCase()
    .trim();
  return raw === 'true' || raw === '1' || raw === 'on';
}

/**
 * Phase 3 live-money switch. Phase 2 must treat true as "do not send
 * application_fee" (keep the current platform-collector path).
 */
export function isMarketplaceSplitAllowLive(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(env.MP_MARKETPLACE_SPLIT_ALLOW_LIVE || '')
    .toLowerCase()
    .trim();
  return raw === 'true' || raw === '1' || raw === 'on';
}

export function marketplaceClientId(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.MP_MARKETPLACE_CLIENT_ID || env.MP_CLIENT_ID || '').trim();
}

export function marketplaceClientSecret(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.MP_MARKETPLACE_CLIENT_SECRET || env.MP_CLIENT_SECRET || '').trim();
}

export { envFlagTrue };
