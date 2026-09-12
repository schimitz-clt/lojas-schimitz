import assert from 'assert';
import { redactSecrets } from './structured-log';

const red = redactSecrets({
  requestId: 'req-1',
  password: 'hunter2',
  apiKey: 'sk-live-abcdef',
  note: 'ok',
  nested: { refreshToken: 'abc', path: '/health' },
  authHeader: 'Bearer eyJhbGciOiJIUzI1NiJ9.xxx',
});

assert.equal(red.requestId, 'req-1');
assert.equal(red.password, '[REDACTED]');
assert.equal(red.apiKey, '[REDACTED]');
assert.equal(red.note, 'ok');
assert.deepEqual(red.nested, { refreshToken: '[REDACTED]', path: '/health' });
assert.equal(red.authHeader, '[REDACTED]');
assert.equal(JSON.stringify(red).includes('hunter2'), false);
assert.equal(JSON.stringify(red).includes('sk-live'), false);

console.log('structured-log unit tests ok');
