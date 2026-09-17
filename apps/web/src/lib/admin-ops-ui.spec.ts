import assert from 'assert';
import {
  advanceSuccessMessage,
  copySuccessMessage,
  emptyOrdersQueueMessage,
  paymentMethodBadge,
  paymentMethodLabelPt,
  pickPrimaryPayment,
  separarPrimaryLabel,
  whatsAppOpsButtonLabel,
} from './admin-ops-ui';

assert.equal(paymentMethodLabelPt('pix'), 'PIX');
assert.equal(paymentMethodLabelPt('card'), 'Cartão');
assert.equal(paymentMethodLabelPt(null), null);

assert.equal(pickPrimaryPayment(null), null);
assert.equal(pickPrimaryPayment([]), null);

const paidPix = pickPrimaryPayment([
  { status: 'pending', method: 'card', amount: 10 },
  { status: 'approved', method: 'pix', amount: 95 },
]);
assert.equal(paidPix?.method, 'pix');
assert.equal(Number(paidPix?.amount), 95);

const badge = paymentMethodBadge([
  { status: 'approved', method: 'pix', amount: '95.00' },
]);
assert.ok(badge);
assert.equal(badge!.label, 'PIX');
assert.equal(badge!.kind, 'pix');
assert.equal(badge!.amount, 95);

const cardBadge = paymentMethodBadge([{ status: 'approved', method: 'card', amount: 120 }]);
assert.equal(cardBadge!.label, 'Cartão');
assert.equal(cardBadge!.kind, 'card');

assert.equal(paymentMethodBadge([{ status: 'pending' }]), null, 'no method → no badge');

assert.equal(separarPrimaryLabel('paid', 'organizing'), 'Separar agora');
assert.equal(separarPrimaryLabel('organizing', 'packing'), 'Separar (Embalagem)');
assert.equal(separarPrimaryLabel('packing', 'ready_for_pickup'), null);

assert.equal(copySuccessMessage('publicId', 'SCH-ABC'), 'publicId copiado: SCH-ABC');
assert.equal(copySuccessMessage('tracking', 'BR123'), 'Rastreio copiado: BR123');

assert.equal(
  advanceSuccessMessage('SCH-1', 'Organizando'),
  'Pedido SCH-1 → Organizando.',
);

assert.ok(
  emptyOrdersQueueMessage({
    hasSearch: false,
    roiFilter: 'all',
    statusFilter: 'paid',
  }).includes('Fila Pagos vazia'),
);
assert.ok(
  emptyOrdersQueueMessage({
    hasSearch: false,
    roiFilter: 'stuck_paid',
    statusFilter: 'paid',
  }).includes('travado'),
);

assert.equal(whatsAppOpsButtonLabel(true, 'paid'), 'WhatsApp cliente (pago)');
assert.equal(whatsAppOpsButtonLabel(false, 'generic'), 'WhatsApp loja (rascunho)');
assert.equal(whatsAppOpsButtonLabel(true, 'generic'), 'WhatsApp cliente');

console.log('admin-ops-ui web unit ok');
