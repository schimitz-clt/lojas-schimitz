/**
 * Production seed must not insert or backfill placehold.co.
 * No Postgres — pure env guard + seed.ts source check.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isProductionPlaceholderSeedEnv,
  shouldInsertPlaceholderProductImages,
} from '../../../../../prisma/seed-placeholder-policy';

assert.equal(isProductionPlaceholderSeedEnv({ NODE_ENV: 'production' }), true);
assert.equal(isProductionPlaceholderSeedEnv({ NODE_ENV: 'Production' }), true);
assert.equal(isProductionPlaceholderSeedEnv({ NODE_ENV: ' production ' }), true);
assert.equal(shouldInsertPlaceholderProductImages({ NODE_ENV: 'production' }), false);
assert.equal(shouldInsertPlaceholderProductImages({ RAILWAY_ENVIRONMENT: 'production' }), false);
assert.equal(
  shouldInsertPlaceholderProductImages({
    NODE_ENV: 'development',
    RAILWAY_ENVIRONMENT: 'production',
  }),
  false,
);
assert.equal(
  shouldInsertPlaceholderProductImages({
    NODE_ENV: 'production',
    RAILWAY_ENVIRONMENT: 'staging',
  }),
  false,
);
assert.equal(shouldInsertPlaceholderProductImages({ NODE_ENV: 'development' }), true);
assert.equal(shouldInsertPlaceholderProductImages({ NODE_ENV: 'test' }), true);
assert.equal(shouldInsertPlaceholderProductImages({}), true);
assert.equal(shouldInsertPlaceholderProductImages({ RAILWAY_ENVIRONMENT: 'staging' }), true);
assert.equal(shouldInsertPlaceholderProductImages({ RAILWAY_ENVIRONMENT: 'pr-12' }), true);
assert.equal(
  shouldInsertPlaceholderProductImages({ NODE_ENV: 'development', RAILWAY_ENVIRONMENT: '' }),
  true,
);

const seed = readFileSync(join(__dirname, '../../../../../prisma/seed.ts'), 'utf8');
assert.ok(seed.includes("from './seed-placeholder-policy'"));
assert.ok(
  seed.includes('if (!hasImg && shouldInsertPlaceholderProductImages())'),
  'demo catalog insert is production-gated',
);
assert.ok(
  seed.includes('if (shouldInsertPlaceholderProductImages())'),
  'missing-image backfill is production-gated',
);
assert.ok(
  seed.includes('https://placehold.co/800x800/1a1a1a/f5c518?text='),
  'local/dev seed still has the placeholder template',
);
assert.equal(seed.includes('productImage.delete'), false, 'seed must not delete existing photos');
assert.ok(
  seed.includes('Existing photos were not changed'),
  'production path logs that existing rows stay',
);

console.log('seed placeholder policy unit tests ok');
