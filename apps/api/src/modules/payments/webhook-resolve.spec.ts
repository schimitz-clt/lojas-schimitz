import assert from 'assert';
import { pickLinkablePayment, resolveWebhookPayment } from './webhook-resolve';

assert.equal(
  resolveWebhookPayment({
    byExternalId: true,
    externalReference: 'SCH-1',
    orderFoundByPublicId: true,
    pendingWithoutExternalId: false,
    unboundPaymentOnOrder: false,
  }),
  'found',
);

assert.equal(
  resolveWebhookPayment({
    byExternalId: false,
    externalReference: 'SCH-1',
    orderFoundByPublicId: true,
    pendingWithoutExternalId: true,
    unboundPaymentOnOrder: false,
  }),
  'link_pending',
);

assert.equal(
  resolveWebhookPayment({
    byExternalId: false,
    externalReference: 'SCH-1',
    orderFoundByPublicId: true,
    pendingWithoutExternalId: false,
    unboundPaymentOnOrder: true,
  }),
  'link_unbound',
);

assert.equal(
  resolveWebhookPayment({
    byExternalId: false,
    externalReference: 'SCH-1',
    orderFoundByPublicId: true,
    pendingWithoutExternalId: false,
    unboundPaymentOnOrder: false,
  }),
  'orphan',
);

assert.equal(
  resolveWebhookPayment({
    byExternalId: false,
    externalReference: 'SCH-1',
    orderFoundByPublicId: false,
    pendingWithoutExternalId: true,
    unboundPaymentOnOrder: true,
  }),
  'orphan',
);

assert.equal(
  resolveWebhookPayment({
    byExternalId: false,
    externalReference: '',
    orderFoundByPublicId: true,
    pendingWithoutExternalId: true,
    unboundPaymentOnOrder: true,
  }),
  'orphan',
);

const picked = pickLinkablePayment([
  { status: 'cancelled', externalId: null },
  { status: 'pending', externalId: null },
  { status: 'approved', externalId: 'x' },
]);
assert.equal(picked?.status, 'pending');

const unboundOnly = pickLinkablePayment([{ status: 'cancelled', externalId: null }]);
assert.equal(unboundOnly?.status, 'cancelled');

const none = pickLinkablePayment([{ status: 'approved', externalId: 'mp-1' }]);
assert.equal(none, undefined);

console.log('webhook-resolve unit tests ok');
