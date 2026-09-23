import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ENTERPRISE_MISSING } from './admin-enterprise-ui';
import {
  isOrderRefundAllowed,
  isRefundPaymentId,
  paymentRefundAttentionCopy,
  paymentRefundConfirmCopy,
  paymentRefundErrorText,
  paymentRefundOffer,
  paymentRefundRefreshFailureText,
  paymentRefundRowLine,
  paymentRefundSuccessMessage,
  readApiErrorCode,
  REFUND_ALLOWED_ORDER_STATUSES,
} from './admin-payment-refund-ui';

const approved = {
  id: 'ckpay1234567890',
  status: 'approved',
  method: 'pix',
  amount: 100,
};

assert.deepEqual(
  [...REFUND_ALLOWED_ORDER_STATUSES],
  ['paid', 'organizing', 'packing', 'ready_for_pickup', 'in_transit', 'separating', 'shipped'],
);
for (const status of REFUND_ALLOWED_ORDER_STATUSES) {
  assert.equal(isOrderRefundAllowed(status), true, status);
}
for (const status of ['draft', 'awaiting_payment', 'delivered', 'cancelled', 'refunded', '', ' Paid ']) {
  assert.equal(isOrderRefundAllowed(status), status.trim().toLowerCase() === 'paid', status);
}

assert.equal(isRefundPaymentId(''), false);
assert.equal(isRefundPaymentId('short'), false);
assert.equal(isRefundPaymentId('ckpay/12345678'), false);
assert.equal(isRefundPaymentId('ckpay1234567890'), true);
assert.equal(isRefundPaymentId('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'), true);

const offer = paymentRefundOffer({ status: 'paid', payments: [approved, { id: 'ckpaypending1', status: 'pending', amount: 1 }] });
assert.equal(offer.length, 1);
assert.equal(offer[0]?.id, approved.id);
assert.equal(paymentRefundOffer({ status: 'delivered', payments: [approved] }).length, 0);
assert.equal(paymentRefundOffer({ status: 'awaiting_payment', payments: [approved] }).length, 0);
assert.equal(paymentRefundOffer({ status: 'paid', payments: [{ status: 'approved', amount: 10 }] }).length, 0);
assert.equal(paymentRefundOffer({ status: 'paid', payments: [] }).length, 0);
assert.equal(paymentRefundOffer({ status: 'in_transit', payments: [{ ...approved, status: 'APPROVED' }] }).length, 1);

const attention = paymentRefundAttentionCopy({ publicId: 'SCH-9', count: 1 });
assert.ok(attention.title.includes('Atenção'));
assert.ok(attention.title.includes('SCH-9'));
assert.ok(attention.detail.includes('Mercado Pago'));
assert.ok(attention.detail.includes('Voltar não chama a API'));

const row = paymentRefundRowLine(approved);
assert.ok(row.includes(approved.id));
assert.ok(row.includes('pix'));
assert.ok(row.includes('100'));
assert.equal(paymentRefundRowLine({}).includes(ENTERPRISE_MISSING), true);

const confirm = paymentRefundConfirmCopy({
  publicId: 'SCH-9',
  orderId: 'ord_12345678',
  orderStatus: 'paid',
  paymentId: approved.id,
  amount: 100,
});
assert.ok(confirm.title.includes('SCH-9'));
assert.ok(confirm.detail.includes('ord_12345678'));
assert.ok(confirm.detail.includes(approved.id));
assert.ok(confirm.detail.includes('100'));
assert.ok(confirm.detail.includes('POST /admin/payments/:id/refund'));
assert.ok(confirm.detail.includes('Mercado Pago na hora'));
assert.ok(confirm.detail.includes('estoque dos itens volta'));
assert.ok(confirm.detail.includes('Voltar não chama a API'));

const shipped = paymentRefundConfirmCopy({
  publicId: 'SCH-2',
  orderId: 'ord_22345678',
  orderStatus: 'in_transit',
  paymentId: approved.id,
  amount: null,
});
assert.ok(shipped.detail.includes(ENTERPRISE_MISSING));
assert.ok(shipped.detail.includes('não repõe estoque'));
assert.equal(paymentRefundConfirmCopy({}).title.includes(ENTERPRISE_MISSING), true);

assert.ok(paymentRefundSuccessMessage({ publicId: 'SCH-9', idempotent: false }).includes('Estorno confirmado'));
assert.ok(paymentRefundSuccessMessage({ publicId: 'SCH-9', idempotent: true }).includes('já estava estornado'));
assert.ok(paymentRefundSuccessMessage({ publicId: 'SCH-9', idempotent: true }).includes('Nada novo foi enviado'));
assert.equal(paymentRefundSuccessMessage({}).includes(ENTERPRISE_MISSING), true);

assert.ok(paymentRefundErrorText('PAYMENT_NOT_APPROVED', 'ignorado').includes('PAYMENT_NOT_APPROVED'));
assert.ok(paymentRefundErrorText('PAYMENT_NOT_APPROVED', 'ignorado').includes('approved'));
assert.ok(paymentRefundErrorText('ORDER_REFUND_NOT_ALLOWED', '').includes('não permite estorno'));
assert.ok(paymentRefundErrorText('PROVIDER_REFUND_PENDING', '').includes('Mercado Pago não confirmou'));
assert.ok(paymentRefundErrorText('PAYMENT_NOT_FOUND', '').includes('não encontrado'));
assert.ok(paymentRefundErrorText('PAYMENT_NO_EXTERNAL_ID', '').includes('externalId'));
assert.equal(
  paymentRefundErrorText('OTHER_CODE', 'Falhou no provedor'),
  'OTHER_CODE: Falhou no provedor',
);
assert.equal(paymentRefundErrorText('', 'Sem código'), 'Sem código');
assert.ok(paymentRefundErrorText('', '  ').includes('não confirmou o estorno'));
assert.ok(paymentRefundRefreshFailureText('Estorno confirmado para SCH-9.').includes('não recarregou'));

const coded = new Error('Somente pagamento approved pode ser estornado') as Error & { code?: string };
coded.code = 'PAYMENT_NOT_APPROVED';
assert.equal(readApiErrorCode(coded), 'PAYMENT_NOT_APPROVED');
assert.equal(readApiErrorCode(new Error('x')), '');
assert.equal(readApiErrorCode('PAYMENT_NOT_APPROVED'), '');
assert.equal(readApiErrorCode(null), '');

const srcRoot = join(__dirname, '..');
const dossier = readFileSync(join(srcRoot, 'components/admin/AdminOrderDossier.tsx'), 'utf8');
const pedidos = readFileSync(join(srcRoot, 'components/admin/sections/AdminPedidosSection.tsx'), 'utf8');
const state = readFileSync(join(srcRoot, 'components/admin/admin-console-state.ts'), 'utf8');
const ops = readFileSync(join(srcRoot, 'components/admin/sections/AdminOpsSection.tsx'), 'utf8');
const apiSrc = readFileSync(join(__dirname, 'api.ts'), 'utf8');

assert.ok(dossier.includes('paymentRefundConfirmCopy'), 'confirm copy is the dossier panel');
assert.ok(dossier.includes('admin-ent-confirm'), 'refund uses the existing confirm panel');
assert.ok(dossier.includes('admin-ent-refund'), 'danger attention sits on the dossier');
assert.ok(dossier.includes('onAskRefund(id)'), 'Estornar opens confirmation and does not call the API');
assert.ok(dossier.includes('onCancelRefund'), 'Voltar stays on the cancel handler');
assert.ok(dossier.includes('Voltar'), 'Voltar label matches push confirm');
assert.equal(dossier.includes('fetch('), false, 'dossier does not call the network itself');
assert.equal(dossier.includes('/admin/payments/'), false, 'POST path stays in the console state');

assert.ok(pedidos.includes('setRefundPaymentId(paymentId)'), 'ask stores the id and does not POST');
assert.ok(pedidos.includes('refundPayment(openOrder, paymentId)'), 'only confirm calls the refund helper');
assert.ok(state.includes('`/admin/payments/${id}/refund`'), 'confirm posts the existing refund endpoint');
assert.ok(state.includes('paymentRefundErrorText'), 'API codes stay visible');
assert.ok(apiSrc.includes('err.code = code'), 'admin fetch keeps the API error code');

assert.equal(ops.includes('/refund'), false, 'reconciliations do not gain a refund call');
assert.ok(ops.includes('Não executar estorno'), 'orphan review stays manual');

console.log('admin-payment-refund-ui spec ok');
