import assert from 'node:assert/strict';
import { summarizeClientError } from './client-error';

assert.equal(summarizeClientError(null), null);
assert.equal(summarizeClientError('x'), null);
assert.equal(summarizeClientError([]), null);
assert.equal(summarizeClientError({ kind: 'onerror' }), null); // no message → ignored

const r = summarizeClientError({
  kind: 'boundary',
  message: 'Cannot read properties of undefined (reading "price") for ana@mail.com',
  errorName: 'TypeError',
  stack: 'TypeError: x\n    at ProductCard (https://lojasschimitz.com.br/_next/static/chunks/app.js:1:2345)',
  digest: '12345<script>',
  page: 'https://lojasschimitz.com.br/redefinir-senha?token=SECRET123&email=ana@mail.com',
  source: 'https://lojasschimitz.com.br/_next/static/chunks/app.js?v=1',
  line: 1,
  column: 2345,
  userAgent: 'Mozilla/5.0',
  cookie: 'session=abc',
})!;
assert.equal(r.kind, 'boundary');
assert.equal(r.page, '/redefinir-senha');
assert.equal(r.source, '/_next/static/chunks/app.js');
assert.equal(r.digest, '12345script');
assert.equal(r.line, 1);
assert.equal(r.column, 2345);
const json = JSON.stringify(r);
for (const leak of ['ana@mail.com', 'SECRET123', 'session=abc', 'cookie']) assert.equal(json.includes(leak), false, leak);
assert.ok(r.message.includes('[EMAIL]'));

// unknown kind → onerror, bounded sizes
const big = summarizeClientError({ kind: 'evil', message: 'm'.repeat(10_000), stack: 's'.repeat(10_000), line: -1 })!;
assert.equal(big.kind, 'onerror');
assert.ok(big.message.length < 340);
assert.ok(big.stack!.length < 2040);
assert.equal(big.line, undefined);

console.log('client-error.spec OK');
