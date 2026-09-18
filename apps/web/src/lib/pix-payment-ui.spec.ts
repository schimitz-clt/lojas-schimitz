import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  isInProgressOrderStatus,
  isPixPaidLikeOrder,
  pickInProgressOrder,
  PIX_APPROVED_COPY,
  showPixGate,
} from './pix-payment-ui';

assert.equal(showPixGate('pending', 'awaiting_payment'), true);
assert.equal(showPixGate('pending', 'draft'), true);
assert.equal(showPixGate('pending', 'paid'), false);
assert.equal(showPixGate('pending', 'organizing'), false);
assert.equal(showPixGate('approved', 'awaiting_payment'), false);
assert.equal(showPixGate('approved', 'paid'), false);
assert.equal(showPixGate('approved', 'organizing'), false);
assert.equal(showPixGate('pending', 'in_transit'), false);
assert.equal(showPixGate('pending', 'delivered'), false);
assert.equal(showPixGate(null, 'awaiting_payment'), false);
assert.equal(showPixGate('pending', null), false);
assert.equal(showPixGate(undefined, undefined), false);

// Non-PIX pending must never open the QR gate (card Brick path).
assert.equal(showPixGate('pending', 'awaiting_payment', 'card'), false);
assert.equal(showPixGate('pending', 'awaiting_payment', 'pix'), true);
assert.equal(showPixGate('pending', 'awaiting_payment', undefined), true);

for (const s of ['paid', 'organizing', 'packing', 'ready_for_pickup', 'in_transit', 'delivered']) {
  assert.equal(isPixPaidLikeOrder(s), true, s);
  assert.equal(showPixGate('pending', s), false, `no QR while ${s}`);
  assert.equal(showPixGate('approved', s), false, `no QR approved+${s}`);
}

assert.equal(isInProgressOrderStatus('awaiting_payment'), true);
assert.equal(isInProgressOrderStatus('organizing'), true);
assert.equal(isInProgressOrderStatus('delivered'), false);
assert.equal(isInProgressOrderStatus('cancelled'), false);
assert.equal(isInProgressOrderStatus('refunded'), false);

assert.equal(
  pickInProgressOrder([
    { status: 'delivered', publicId: 'OLD' },
    { status: 'organizing', publicId: 'SCH-1' },
  ])?.publicId,
  'SCH-1',
);
assert.equal(pickInProgressOrder([{ status: 'delivered' }, { status: 'cancelled' }]), null);
assert.equal(pickInProgressOrder([]), null);

assert.equal(PIX_APPROVED_COPY, 'Pagamento PIX: Aprovado');

const pedido = readFileSync(join(__dirname, '../app/pedidos/[publicId]/page.tsx'), 'utf8');
assert.ok(pedido.includes('showPixGate'), 'order page uses showPixGate');
assert.ok(pedido.includes('PIX_APPROVED_COPY'), 'approved copy');
assert.ok(pedido.includes('isPixPromoCollidingCouponCode'), 'order page skips stacked PIX 5% preview');
assert.ok(!/isPixPending \|\| \(intent\.payment\.method === 'pix' && \(qr \|\| qrImgSrc\)\)/.test(pedido), 'old QR OR-payload gate removed');

const conta = readFileSync(join(__dirname, '../app/conta/page.tsx'), 'utf8');
assert.ok(conta.includes("api") && conta.includes('/orders'), 'conta loads real /orders');
assert.ok(conta.includes('Pedido em andamento') || conta.includes('pickInProgressOrder'), 'in-progress card');

console.log('pix-payment-ui unit + source gate tests ok');
