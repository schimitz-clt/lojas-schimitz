import assert from 'assert';
import {
  ORDER_STATUS_LABEL,
  orderStatusLabel,
  fulfillmentTimelineLabel,
  fulfillmentStepIndex,
  FULFILLMENT_STEPS,
  POST_PAID_STATUSES,
  isPostPaidStatus,
} from './order-status';

assert.equal(orderStatusLabel('awaiting_payment'), 'Aguardando pagamento');
assert.equal(orderStatusLabel('paid'), 'Pago');
assert.equal(orderStatusLabel('organizing'), 'Organizando');
assert.equal(orderStatusLabel('in_transit'), 'Em trânsito');
assert.equal(orderStatusLabel('delivered'), 'Entregue');
assert.equal(orderStatusLabel('cancelled'), 'Cancelado');
assert.equal(ORDER_STATUS_LABEL.refunded, 'Reembolsado');

assert.equal(fulfillmentTimelineLabel('paid'), 'Compra');
assert.equal(fulfillmentTimelineLabel('separating'), 'Organizando');
assert.equal(fulfillmentTimelineLabel('shipped'), 'Em trânsito');

assert.equal(fulfillmentStepIndex('awaiting_payment'), -1);
assert.equal(fulfillmentStepIndex('draft'), -1);
assert.equal(fulfillmentStepIndex('paid'), 0);
assert.equal(fulfillmentStepIndex('delivered'), FULFILLMENT_STEPS.length - 1);
assert.equal(fulfillmentStepIndex('separating'), fulfillmentStepIndex('organizing'));
assert.equal(fulfillmentStepIndex('shipped'), fulfillmentStepIndex('in_transit'));

// Never invent paid for unknown/pending-like statuses
assert.notEqual(orderStatusLabel('awaiting_payment'), 'Pago');
assert.equal(fulfillmentStepIndex('awaiting_payment') < 0, true);

// Resend store-paid notify: UI must allow same statuses as API POST_PAID_STATUSES
assert.equal(isPostPaidStatus('paid'), true);
assert.equal(isPostPaidStatus('organizing'), true);
assert.equal(isPostPaidStatus('packing'), true);
assert.equal(isPostPaidStatus('ready_for_pickup'), true);
assert.equal(isPostPaidStatus('in_transit'), true);
assert.equal(isPostPaidStatus('delivered'), true);
assert.equal(isPostPaidStatus('separating'), true);
assert.equal(isPostPaidStatus('shipped'), true);
assert.equal(isPostPaidStatus('awaiting_payment'), false);
assert.equal(isPostPaidStatus('cancelled'), false);
assert.equal(isPostPaidStatus('refunded'), false);
assert.ok(POST_PAID_STATUSES.includes('packing'));

console.log('order-status label mapping ok');
