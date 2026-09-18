import assert from 'assert';
import {
  isNextProductionBuild,
  PUBLIC_DEV_ONLY_ENV_KEYS,
  stripPublicDevOnlyFlags,
} from './strip-public-dev-flags';

assert.equal(isNextProductionBuild({ NODE_ENV: 'production' }), true);
assert.equal(isNextProductionBuild({ NODE_ENV: 'development' }), false);
assert.equal(isNextProductionBuild({}), false);

const dev = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE: 'true',
  NEXT_PUBLIC_NULL_WEBHOOK_SECRET: 'local-dev-secret-16',
};
assert.deepEqual(stripPublicDevOnlyFlags(dev), []);
assert.equal(dev.NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE, 'true');
assert.equal(dev.NEXT_PUBLIC_NULL_WEBHOOK_SECRET, 'local-dev-secret-16');

const prod = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE: 'true',
  NEXT_PUBLIC_NULL_WEBHOOK_SECRET: 'should-never-ship',
  NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY: 'APP_USR-public-ok',
};
const stripped = stripPublicDevOnlyFlags(prod);
assert.deepEqual(stripped.slice().sort(), [...PUBLIC_DEV_ONLY_ENV_KEYS].slice().sort());
assert.equal('NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE' in prod, false);
assert.equal('NEXT_PUBLIC_NULL_WEBHOOK_SECRET' in prod, false);
assert.equal(prod.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY, 'APP_USR-public-ok');

const prodEmpty = { NODE_ENV: 'production' } as Record<string, string | undefined>;
assert.deepEqual(stripPublicDevOnlyFlags(prodEmpty), []);
assert.equal('NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE' in prodEmpty, false);
assert.equal('NEXT_PUBLIC_NULL_WEBHOOK_SECRET' in prodEmpty, false);

console.log('strip-public-dev-flags tests ok');
