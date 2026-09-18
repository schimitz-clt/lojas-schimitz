import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isPaymentSimulateUiEnabled, paymentSimulateWebhookSecret } from './payment-simulate';

const prodOn = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE: 'true',
  NEXT_PUBLIC_NULL_WEBHOOK_SECRET: 'leaked-secret-should-not-ship',
};
assert.equal(isPaymentSimulateUiEnabled(prodOn), false);
assert.equal(paymentSimulateWebhookSecret(prodOn), '');

const prodOff = { NODE_ENV: 'production' };
assert.equal(isPaymentSimulateUiEnabled(prodOff), false);
assert.equal(paymentSimulateWebhookSecret(prodOff), '');

const devOn = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE: 'true',
  NEXT_PUBLIC_NULL_WEBHOOK_SECRET: 'local-dev-secret-16',
};
assert.equal(isPaymentSimulateUiEnabled(devOn), true);
assert.equal(paymentSimulateWebhookSecret(devOn), 'local-dev-secret-16');

const devFlagOff = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE: 'true',
};
assert.equal(paymentSimulateWebhookSecret({ ...devFlagOff, NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE: 'false' }), '');

const page = readFileSync(join(__dirname, '../app/pedidos/[publicId]/page.tsx'), 'utf8');
assert.ok(page.includes('isPaymentSimulateUiEnabled'), 'order page gates simulate via helper');
assert.ok(page.includes('paymentSimulateWebhookSecret'), 'order page does not read raw NEXT_PUBLIC secret');
assert.ok(
  !page.includes("process.env.NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE === 'true'"),
  'order page must not read simulate flag raw',
);
assert.ok(!page.includes('process.env.NEXT_PUBLIC_NULL_WEBHOOK_SECRET'), 'no raw secret env on order page');

const nextConfig = readFileSync(join(__dirname, '../../next.config.ts'), 'utf8');
assert.ok(nextConfig.includes('stripPublicDevOnlyFlags'), 'next.config strips public dev flags in prod builds');

console.log('payment-simulate tests ok');
