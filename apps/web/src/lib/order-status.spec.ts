import assert from 'assert';
import {
  ORDER_STATUS_LABEL,
  orderStatusLabel,
  fulfillmentTimelineLabel,
  fulfillmentStepIndex,
  FULFILLMENT_STEPS,
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

console.log('order-status label mapping ok');
