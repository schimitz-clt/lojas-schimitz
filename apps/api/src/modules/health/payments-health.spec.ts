/**
 * Payments health (H4). Uses the repo's LOCAL TEST fake Mercado Pago server (127.0.0.1, TEST-FAKE- tokens only);
 * never calls api.mercadopago.com, never creates payments.
 */
import assert from 'node:assert/strict';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { opsSignals } from '../../common/sliding-window';
import { FakeMercadoPagoServer } from '../finance/testing/fake-mercadopago.server';
import { PaymentsHealthChecker, evaluatePaymentsHealth, pingMercadoPago, publicPaymentsHealth } from './payments-health';

async function main() {
  opsSignals.reset();
  const fake = new FakeMercadoPagoServer();
  const base = await fake.start();
  try {
    const env = {
      PAYMENTS_PROVIDER: 'mercadopago',
      MERCADO_PAGO_ACCESS_TOKEN: 'TEST-FAKE-health',
      MERCADO_PAGO_API_BASE_URL: base,
      FINANCE_TEST_MODE: 'true',
    } as NodeJS.ProcessEnv;

    // ok: provider answers the read-only call
    const checker = new PaymentsHealthChecker(env);
    const h1 = await checker.check();
    assert.equal(h1.status, 'ok', JSON.stringify(h1));
    assert.equal(h1.checks.providerReachable, true);
    assert.equal(h1.checks.providerHttpStatus, 200);
    assert.deepEqual(h1.reasons, []);
    // only GETs, no payment created
    assert.ok(fake.calls.every((c) => c.method === 'GET' && c.path === '/v1/payment_methods'));
    assert.equal(fake.payments.size, 0);

    // cached: second check does not call MP again
    const callsBefore = fake.calls.length;
    await checker.check();
    assert.equal(fake.calls.length, callsBefore);

    // concurrent callers share one ping
    const c2 = new PaymentsHealthChecker(env);
    const n0 = fake.calls.length;
    await Promise.all([c2.check(), c2.check(), c2.check()]);
    assert.equal(fake.calls.length, n0 + 1);

    // wrong token → down (unauthorized)
    const bad = await new PaymentsHealthChecker({ ...env, MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-not-accepted' }).check();
    assert.equal(bad.status, 'down');
    assert.deepEqual(bad.reasons, ['provider_unauthorized']);
    assert.equal(JSON.stringify(bad).includes('APP_USR'), false);

    // provider 5xx → down (http_error)
    fake.failures.push({ match: (m, p) => m === 'GET' && p === '/v1/payment_methods', status: 503, remaining: 1 });
    const five = await new PaymentsHealthChecker(env).check();
    assert.deepEqual(five.reasons, ['provider_http_error']);

    // missing token → down
    const missing = await new PaymentsHealthChecker({ ...env, MERCADO_PAGO_ACCESS_TOKEN: '' }).check();
    assert.deepEqual(missing.reasons, ['provider_not_configured']);

    // provider errors burst → down even if MP answers
    for (let i = 0; i < 5; i++) opsSignals.record('provider_errors');
    const burst = await new PaymentsHealthChecker(env).check();
    assert.deepEqual(burst.reasons, ['provider_errors_burst']);
    assert.equal(burst.recent15m.providerErrors, 5);
    opsSignals.reset();
  } finally {
    await fake.stop();
  }

  // unreachable host (closed port) → timeout_or_network
  const srv = createServer();
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const port = (srv.address() as AddressInfo).port;
  await new Promise<void>((r) => srv.close(() => r()));
  const ping = await pingMercadoPago({ MERCADO_PAGO_API_BASE_URL: `http://127.0.0.1:${port}`, MERCADO_PAGO_ACCESS_TOKEN: 'TEST-FAKE-x' } as NodeJS.ProcessEnv, 2000);
  assert.equal(ping.reachable, false);
  assert.equal(ping.reason, 'timeout_or_network');

  // FINANCE_TEST_MODE blocks the real host
  const blocked = await pingMercadoPago({ FINANCE_TEST_MODE: 'true', MERCADO_PAGO_ACCESS_TOKEN: 'x' } as NodeJS.ProcessEnv);
  assert.equal(blocked.reason, 'blocked_in_test');

  // null provider (local dev) → ok, no ping
  const nul = await new PaymentsHealthChecker({ PAYMENTS_PROVIDER: 'null' } as NodeJS.ProcessEnv).check();
  assert.equal(nul.status, 'ok');
  assert.equal(nul.checks.providerReachable, null);

  // evaluator is pure
  const e = evaluatePaymentsHealth({
    provider: 'mercadopago',
    configured: true,
    ping: null,
    recent: { providerErrors: 0, webhookFailures: 3, webhookProcessingFailures: 0, paymentsFailed: 1, paymentsPaid: 2 },
    maxProviderErrors: 5,
  });
  assert.equal(e.status, 'ok');

  // público em produção: sem contadores de vendas; fora de produção, corpo completo
  const pubProd = publicPaymentsHealth(e, true);
  assert.equal('recent15m' in pubProd, false, 'produção não expõe volume de pagamentos');
  assert.equal(pubProd.status, 'ok');
  assert.deepEqual(pubProd.checks, e.checks);
  assert.ok(!JSON.stringify(pubProd).includes('paymentsPaid'));
  assert.deepEqual(publicPaymentsHealth(e, false).recent15m, e.recent15m);
  const down = evaluatePaymentsHealth({
    provider: 'mercadopago',
    configured: false,
    ping: null,
    recent: { providerErrors: 9, webhookFailures: 0, webhookProcessingFailures: 0, paymentsFailed: 9, paymentsPaid: 0 },
    maxProviderErrors: 5,
  });
  const pubDown = publicPaymentsHealth(down, true);
  assert.equal(pubDown.status, 'down');
  assert.ok(pubDown.reasons.includes('provider_errors_burst'), 'motivo continua visível para o monitor');

  console.log('payments-health.spec OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
