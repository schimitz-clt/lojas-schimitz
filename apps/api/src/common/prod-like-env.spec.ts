import assert from 'assert';
import { isProdLikeEnv } from './prod-like-env';

assert.equal(isProdLikeEnv({}), false);
assert.equal(isProdLikeEnv({ APP_ENV: 'development', NODE_ENV: 'development' }), false);
assert.equal(isProdLikeEnv({ APP_ENV: 'test', NODE_ENV: 'test' }), false);

assert.equal(isProdLikeEnv({ APP_ENV: 'production' }), true);
assert.equal(isProdLikeEnv({ APP_ENV: 'prod' }), true);
assert.equal(isProdLikeEnv({ APP_ENV: 'staging' }), true);
assert.equal(isProdLikeEnv({ NODE_ENV: 'production' }), true);
assert.equal(isProdLikeEnv({ NODE_ENV: 'PRODUCTION' }), true);

// Stray APP_ENV=development must not override a production Node process.
assert.equal(
  isProdLikeEnv({ APP_ENV: 'development', NODE_ENV: 'production' }),
  true,
  'NODE_ENV=production is prod-like even if APP_ENV is development',
);

// Railway production/staging even with local-looking APP_ENV.
assert.equal(
  isProdLikeEnv({
    APP_ENV: 'development',
    NODE_ENV: 'development',
    RAILWAY_ENVIRONMENT: 'production',
  }),
  true,
);
assert.equal(
  isProdLikeEnv({
    APP_ENV: 'development',
    NODE_ENV: 'development',
    RAILWAY_ENVIRONMENT_NAME: 'production',
  }),
  true,
);
assert.equal(
  isProdLikeEnv({
    APP_ENV: 'development',
    NODE_ENV: 'development',
    RAILWAY_ENVIRONMENT: 'staging',
  }),
  true,
);
assert.equal(
  isProdLikeEnv({
    APP_ENV: 'development',
    NODE_ENV: 'development',
    RAILWAY_ENVIRONMENT: 'pr-123',
  }),
  false,
);

console.log('prod-like-env tests ok');
