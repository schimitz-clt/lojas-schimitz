import assert from 'assert';
import { isProdLikeAppEnv, shouldEnableSwagger } from './swagger';

const saved = { ...process.env };

function reset() {
  for (const k of ['APP_ENV', 'NODE_ENV', 'SWAGGER_ENABLED', 'RAILWAY_ENVIRONMENT', 'RAILWAY_ENVIRONMENT_NAME']) {
    if (k in saved) process.env[k] = saved[k]!;
    else delete process.env[k];
  }
}

try {
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  delete process.env.SWAGGER_ENABLED;
  delete process.env.RAILWAY_ENVIRONMENT;
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  assert.equal(isProdLikeAppEnv(), false);
  assert.equal(shouldEnableSwagger(), true);

  process.env.APP_ENV = 'production';
  assert.equal(isProdLikeAppEnv(), true);
  assert.equal(shouldEnableSwagger(), false);

  process.env.SWAGGER_ENABLED = 'true';
  assert.equal(shouldEnableSwagger(), true);

  process.env.APP_ENV = 'development';
  process.env.SWAGGER_ENABLED = 'false';
  assert.equal(shouldEnableSwagger(), false);

  process.env.APP_ENV = 'staging';
  delete process.env.SWAGGER_ENABLED;
  assert.equal(shouldEnableSwagger(), false);

  // Railway production closes Swagger even if APP_ENV looks local (unless SWAGGER_ENABLED=true).
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  delete process.env.SWAGGER_ENABLED;
  process.env.RAILWAY_ENVIRONMENT = 'production';
  assert.equal(isProdLikeAppEnv(), true);
  assert.equal(shouldEnableSwagger(), false);

  console.log('swagger gate tests ok');
} finally {
  for (const k of Object.keys(process.env)) {
    if (!(k in saved)) delete process.env[k];
  }
  Object.assign(process.env, saved);
  reset();
}
