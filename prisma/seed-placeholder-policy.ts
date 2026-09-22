/**
 * Seed may insert placehold.co only outside production.
 * NODE_ENV=production or RAILWAY_ENVIRONMENT=production → do not insert or backfill.
 * Never deletes existing ProductImage rows and never invents a real photo.
 */

export type PlaceholderSeedEnv = {
  NODE_ENV?: string | null;
  RAILWAY_ENVIRONMENT?: string | null;
};

function flag(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function isProductionPlaceholderSeedEnv(env: PlaceholderSeedEnv = process.env): boolean {
  return flag(env.NODE_ENV) === 'production' || flag(env.RAILWAY_ENVIRONMENT) === 'production';
}

/** Local/dev: true. Production: false (skip placeholder insert and backfill). */
export function shouldInsertPlaceholderProductImages(env: PlaceholderSeedEnv = process.env): boolean {
  return !isProductionPlaceholderSeedEnv(env);
}
