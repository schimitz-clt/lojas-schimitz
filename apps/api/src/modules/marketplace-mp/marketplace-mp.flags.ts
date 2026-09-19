/**
 * Mercado Pago marketplace split flags.
 *
 * Phase 1: ENABLED only unlocks OAuth UI + credential storage + refresh job.
 * ALLOW_LIVE is reserved for Phase 2 and MUST NOT be read by createIntent.
 * Default for both: false (unset / empty / anything except explicit true).
 */

function envFlagTrue(name: string): boolean {
  const raw = String(process.env[name] || '')
    .toLowerCase()
    .trim();
  return raw === 'true' || raw === '1' || raw === 'on';
}

/** OAuth connect UI + refresh job. Does not authorize charges or application_fee. */
export function isMarketplaceSplitEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(env.MP_MARKETPLACE_SPLIT_ENABLED || '')
    .toLowerCase()
    .trim();
  return raw === 'true' || raw === '1' || raw === 'on';
}

/**
 * Reserved Phase 2 switch. Phase 1 code must not use this to send
 * application_fee or seller access tokens on payments.
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
