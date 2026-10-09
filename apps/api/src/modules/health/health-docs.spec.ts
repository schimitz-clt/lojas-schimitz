import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluatePaymentsHealth } from './payments-health';

/** docs/API.md must document every /health route and every field /health/payments returns. */
const root = join(__dirname, '../../../../..');
const api = readFileSync(join(root, 'docs/API.md'), 'utf8');
for (const route of ['`/health`', '`/health/ready`', '`/health/payments`']) {
  assert.ok(api.includes(`| GET | ${route} |`), `docs/API.md documents ${route}`);
}
const paymentsRow = api.split('\n').find((l) => l.includes('| GET | `/health/payments` |'))!;
const sample = evaluatePaymentsHealth({
  provider: 'mercadopago',
  configured: true,
  ping: { reachable: true, httpStatus: 200, checkedAt: new Date(0).toISOString(), latencyMs: 1 },
  recent: { providerErrors: 0, webhookFailures: 0, webhookProcessingFailures: 0, paymentsFailed: 0, paymentsPaid: 0 },
  maxProviderErrors: 5,
  now: new Date(0),
});
const fields = [
  ...Object.keys(sample),
  ...Object.keys(sample.checks),
  ...Object.keys(sample.recent15m),
];
for (const f of fields) assert.ok(paymentsRow.includes(f), `docs /health/payments mentions field ${f}`);

/** CI runner pinned (ubuntu-latest moves to a new major without notice). */
const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
assert.ok(!/runs-on:\s*ubuntu-latest/.test(ci), 'ci.yml must pin the runner image');
assert.ok(/runs-on:\s*ubuntu-24\.04/.test(ci), 'ci.yml uses ubuntu-24.04');

console.log('health-docs.spec OK');
