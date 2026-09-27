import assert from 'assert';
import {
  buildClientErrorPayload,
  ClientErrorLimiter,
  CLIENT_ERROR_ENDPOINT,
  shouldIgnoreClientError,
} from './client-error-report';
import { buildWebServerErrorLine } from './server-error-log';
import { maskPii } from './redact-pii';

// same-origin endpoint (CSP connect-src 'self', goes through the /api/v1 proxy)
assert.equal(CLIENT_ERROR_ENDPOINT, '/api/v1/security/client-error');

// noise ignored
assert.equal(shouldIgnoreClientError('Script error.'), true);
assert.equal(shouldIgnoreClientError('ResizeObserver loop completed with undelivered notifications.'), true);
assert.equal(shouldIgnoreClientError('boom', 'chrome-extension://abc/x.js'), true);
assert.equal(shouldIgnoreClientError(''), true);
assert.equal(shouldIgnoreClientError('Cannot read properties of undefined'), false);

// payload: masked, path only, bounded
const err = new TypeError('price undefined for maria@mail.com cpf 123.456.789-09');
(err as TypeError & { digest?: string }).digest = 'abc123';
const p = buildClientErrorPayload('boundary', err, {
  href: 'https://lojasschimitz.com.br/redefinir-senha?token=SECRET&email=maria@mail.com',
  userAgent: 'Mozilla/5.0',
})!;
assert.equal(p.kind, 'boundary');
assert.equal(p.page, '/redefinir-senha');
assert.equal(p.errorName, 'TypeError');
assert.equal(p.digest, 'abc123');
const j = JSON.stringify(p);
for (const leak of ['maria@mail.com', '123.456.789-09', 'SECRET', 'token=']) assert.equal(j.includes(leak), false, leak);

// non-Error rejections
assert.equal(buildClientErrorPayload('unhandledrejection', 'plain string')!.message, 'plain string');
assert.equal(buildClientErrorPayload('unhandledrejection', { message: 'obj msg' })!.message, 'obj msg');
assert.equal(buildClientErrorPayload('unhandledrejection', undefined), null);

// limiter: dedupe + cap
const lim = new ClientErrorLimiter(3);
const mk = (m: string) => buildClientErrorPayload('onerror', m, { href: '/x' })!;
assert.equal(lim.allow(mk('a')), true);
assert.equal(lim.allow(mk('a')), false);
assert.equal(lim.allow(mk('b')), true);
assert.equal(lim.allow(mk('c')), true);
assert.equal(lim.allow(mk('d')), false);

// server error line (instrumentation onRequestError)
const se = new Error('fetch failed https://api/x?access_token=zzz for joao@x.com');
(se as Error & { digest?: string }).digest = '999';
const line = JSON.parse(
  buildWebServerErrorLine(se, { path: '/produto/abc?utm=1&email=joao@x.com', method: 'GET' }, { routePath: '/produto/[slug]', routeType: 'render' }),
);
assert.equal(line.msg, 'WEB_SERVER_ERROR');
assert.equal(line.level, 'error');
assert.equal(line.path, '/produto/abc');
assert.equal(line.routePath, '/produto/[slug]');
assert.equal(line.digest, '999');
assert.equal(JSON.stringify(line).includes('joao@x.com'), false);
assert.equal(JSON.stringify(line).includes('zzz'), false);

// mirror of API masking behaves the same on the key cases
assert.equal(maskPii('a@b.com 123.456.789-09'), '[EMAIL] [CPF]');

console.log('client-error-report.spec OK');
