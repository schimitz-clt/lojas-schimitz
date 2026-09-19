/**
 * Mercado Pago marketplace split flags.
 *
 * ENABLED: OAuth UI + credential storage + refresh job + split money-path gate
 *   (sandbox when ALLOW_LIVE=false + test credentials; live when ALLOW_LIVE=true
 *   + production/prod-like + APP_USR).
 * ALLOW_LIVE: Phase 3 live-money switch. Default false. true only sends
 *   application_fee together with ENABLED + prod-like host + live APP_USR.
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
 * Phase 3 live-money switch. Combined with ENABLED + prod-like + APP_USR
 * unlocks seller-token + application_fee. Alone it does nothing.
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
