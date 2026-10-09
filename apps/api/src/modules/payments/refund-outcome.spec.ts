import assert from 'assert';
import {
  REFUND_PROCESSING_MESSAGE,
  classifyProviderRefundError,
  legacyRefundIdempotencyKey,
  providerErrorKind,
  refundRejectedMessage,
} from './refund-outcome';
import { mercadoPagoHttpTimeoutMs } from './payment.provider';

const httpErr = (status: number) => Object.assign(new Error(`MP ${status}`), { status });

// Only a clear 4xx is a definitive "no"; everything else must be reconciled.
assert.equal(classifyProviderRefundError(httpErr(400)), 'rejected');
assert.equal(classifyProviderRefundError(httpErr(404)), 'rejected');
for (const s of [408, 409, 425, 429, 500, 502, 503, 504]) assert.equal(classifyProviderRefundError(httpErr(s)), 'uncertain', String(s));
const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
assert.equal(classifyProviderRefundError(timeout), 'uncertain');
const net = Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });
assert.equal(classifyProviderRefundError(net), 'uncertain');
assert.equal(classifyProviderRefundError(null), 'uncertain');

assert.equal(providerErrorKind(httpErr(503)), 'http_503');
assert.equal(providerErrorKind(timeout), 'timeout');
assert.equal(providerErrorKind(net), 'network_UND_ERR_CONNECT_TIMEOUT');
assert.equal(providerErrorKind(new Error('x')), 'network');

assert.match(REFUND_PROCESSING_MESSAGE, /processamento/);
assert.match(REFUND_PROCESSING_MESSAGE, /instantes/);
assert.match(REFUND_PROCESSING_MESSAGE, /nunca é feito duas vezes/);
assert.match(refundRejectedMessage('saldo insuficiente'), /recusou o estorno \(saldo insuficiente\)\. Nada foi devolvido/);
assert.doesNotMatch(refundRejectedMessage(''), /\(\)/);

// Stable per payment ⇒ retries are the same refund at MP.
assert.equal(legacyRefundIdempotencyKey('123'), 'sch-refund-123');
assert.equal(legacyRefundIdempotencyKey('123'), legacyRefundIdempotencyKey('123'));

assert.equal(mercadoPagoHttpTimeoutMs({}), 20_000);
assert.equal(mercadoPagoHttpTimeoutMs({ MP_HTTP_TIMEOUT_MS: '5000' }), 5000);
assert.equal(mercadoPagoHttpTimeoutMs({ MP_HTTP_TIMEOUT_MS: '10' }), 1000);
assert.equal(mercadoPagoHttpTimeoutMs({ MP_HTTP_TIMEOUT_MS: '999999' }), 60_000);
assert.equal(mercadoPagoHttpTimeoutMs({ MP_HTTP_TIMEOUT_MS: 'abc' }), 20_000);

console.log('refund-outcome.spec: OK');
