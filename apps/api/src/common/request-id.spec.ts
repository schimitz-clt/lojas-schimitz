import assert from 'node:assert/strict';
import { requestIdMiddleware, requestIdOf, resolveRequestId } from './request-id';

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

assert.equal(resolveRequestId('abc-123'), 'abc-123');
assert.equal(resolveRequestId(['r1', 'r2']), 'r1');
assert.match(resolveRequestId(undefined), uuidRe);
assert.match(resolveRequestId(''), uuidRe);
assert.match(resolveRequestId('x'.repeat(129)), uuidRe);
// log-injection / junk refused
assert.match(resolveRequestId('abc\n{"level":"error"}'), uuidRe);
assert.match(resolveRequestId('<script>'), uuidRe);

const req: { headers: Record<string, unknown>; requestId?: string } = { headers: {} };
const headers: Record<string, string> = {};
let nextCalled = false;
requestIdMiddleware(req, { setHeader: (k, v) => (headers[k] = v) }, () => (nextCalled = true));
assert.ok(nextCalled);
assert.match(req.requestId!, uuidRe);
assert.equal(headers['x-request-id'], req.requestId);
assert.equal(requestIdOf(req), req.requestId);

const req2: { headers: Record<string, unknown>; requestId?: string } = { headers: { 'x-request-id': 'edge-42' } };
requestIdMiddleware(req2, { setHeader: () => undefined }, () => undefined);
assert.equal(req2.requestId, 'edge-42');

console.log('request-id.spec OK');
