import assert from 'node:assert/strict';
import { HttpException, HttpStatus } from '@nestjs/common';
import { buildClientError } from './http-exception.filter';

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const keys = ['APP_ENV', 'NODE_ENV'];
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) prev[k] = process.env[k];
  for (const k of keys) {
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {
    fn();
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

// Non-HTTP Error in development → message OK, never stack field
withEnv({ APP_ENV: 'development', NODE_ENV: 'development' }, () => {
  const err = new Error('boom-db-connection-string');
  (err as Error & { stack?: string }).stack = 'Error: boom\n    at secret.ts:1:1';
  const { status, body } = buildClientError(err);
  assert.equal(status, 500);
  assert.equal(body.error.message, 'boom-db-connection-string');
  assert.equal('stack' in body.error, false);
  assert.deepEqual(body.error.details, []);
});

// Non-HTTP Error in production → generic
withEnv({ APP_ENV: 'production', NODE_ENV: 'production' }, () => {
  const { status, body } = buildClientError(new Error('prisma P1001 unreachable host'));
  assert.equal(status, 500);
  assert.equal(body.error.message, 'Erro interno');
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.deepEqual(body.error.details, []);
  assert.equal(JSON.stringify(body).includes('prisma'), false);
  assert.equal(JSON.stringify(body).includes('stack'), false);
});

// HttpException 500 in production → generic message (defense-in-depth)
withEnv({ APP_ENV: 'production', NODE_ENV: 'production' }, () => {
  const ex = new HttpException('SELECT * FROM users leaked', HttpStatus.INTERNAL_SERVER_ERROR);
  const { status, body } = buildClientError(ex);
  assert.equal(status, 500);
  assert.equal(body.error.message, 'Erro interno');
  assert.deepEqual(body.error.details, []);
  assert.equal(JSON.stringify(body).includes('SELECT'), false);
});

// HttpException 401 in production → intentional message kept
withEnv({ APP_ENV: 'production', NODE_ENV: 'production' }, () => {
  const ex = new HttpException(
    { code: 'UNAUTHORIZED', message: 'Token ausente' },
    HttpStatus.UNAUTHORIZED,
  );
  const { status, body } = buildClientError(ex);
  assert.equal(status, 401);
  assert.equal(body.error.code, 'UNAUTHORIZED');
  assert.equal(body.error.message, 'Token ausente');
});

// staging treated as prod-like
withEnv({ APP_ENV: 'staging', NODE_ENV: 'production' }, () => {
  const { body } = buildClientError(new Error('disk full /var/lib/postgresql'));
  assert.equal(body.error.message, 'Erro interno');
  assert.equal(JSON.stringify(body).includes('postgresql'), false);
});

console.log('http-exception.filter tests ok');
