import assert from 'node:assert/strict';
import { parseApiEnvelope } from './api-envelope';

const ok = parseApiEnvelope<{ url: string }>('{"ok":true,"data":{"url":"https://x/a.jpg"}}', 200);
assert.equal(ok.ok, true);
if (ok.ok) assert.equal(ok.data.url, 'https://x/a.jpg');

const fail = parseApiEnvelope('{"ok":false,"error":{"code":"UPLOAD_EMPTY","message":"Envie um arquivo"}}', 400, 'Erro no upload');
assert.equal(fail.ok, false);
if (!fail.ok) {
  assert.equal(fail.error.code, 'UPLOAD_EMPTY');
  assert.equal(fail.error.message, 'Envie um arquivo');
}

const empty = parseApiEnvelope('', 502, 'Erro no upload');
assert.equal(empty.ok, false);
if (!empty.ok) {
  assert.ok(empty.error.message.includes('HTTP 502'));
  assert.equal(empty.error.code, 'EMPTY_RESPONSE');
}

const html = parseApiEnvelope('<html>413</html>', 413, 'Erro no upload');
assert.equal(html.ok, false);
if (!html.ok) {
  assert.equal(html.error.code, 'NOT_JSON');
  assert.ok(html.error.message.includes('413'));
}

const emptyOk = parseApiEnvelope('', 200, 'Erro no upload');
assert.equal(emptyOk.ok, false);
if (!emptyOk.ok) assert.ok(emptyOk.error.message.includes('vazia'));

console.log('api-envelope unit tests ok');
