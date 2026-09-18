import assert from 'assert';
import {
  advanceSuccessMessage,
  copySuccessMessage,
  emptyOrdersQueueMessage,
  emptyReconciliationsMessage,
  mailOpsKpiValue,
  opsAlertCodeLabelPt,
  opsAlertSeverityLabelPt,
  paymentMethodBadge,
  paymentMethodLabelPt,
  pickPrimaryPayment,
  reconciliationsKpiHint,
  separarPrimaryLabel,
  storeNotifyCardHint,
  storePaidNotifyResendMessage,
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

assert.equal(opsAlertSeverityLabelPt('critical'), 'Crítico');
assert.equal(opsAlertSeverityLabelPt('high'), 'Alto');
assert.equal(opsAlertSeverityLabelPt('warn'), 'Atenção');
assert.equal(opsAlertCodeLabelPt('open_reconciliations'), 'Pagamentos a conciliar');
assert.equal(opsAlertCodeLabelPt('store_email_send_failed', 'Falha ao enviar e-mail da loja'), 'Falha ao enviar e-mail da loja');

assert.ok(
  storePaidNotifyResendMessage({
    publicId: 'SCH-1',
    inAppCreated: 2,
    emailsAttempted: 0,
    mailOutcome: 'provider_off',
  }).includes('NÃO foi tentado'),
);
assert.ok(
  storePaidNotifyResendMessage({
    publicId: 'SCH-1',
    inAppCreated: 2,
    emailsAttempted: 0,
    mailOutcome: 'no_recipients',
  }).includes('nenhum destinatário'),
);
assert.ok(
  storePaidNotifyResendMessage({
    publicId: 'SCH-1',
    inAppCreated: 1,
    emailsAttempted: 1,
    emailsFailed: 1,
    mailOutcome: 'send_failed',
  }).includes('FALHOU'),
);
assert.ok(
  storePaidNotifyResendMessage({
    publicId: 'SCH-1',
    inAppCreated: 1,
    emailsAttempted: 1,
    emailsSent: 1,
    mailOutcome: 'sent',
  }).includes('e-mail enviado'),
);
assert.ok(
  storePaidNotifyResendMessage({
    publicId: 'SCH-1',
    inAppCreated: 1,
    emailsAttempted: 0,
  }).includes('NÃO tentado'),
);

assert.ok(
  storeNotifyCardHint({
    statusLabel: 'Pago',
    publicId: 'SCH-X',
    mail: {
      configured: true,
      recentFailures: [{ code: 'STORE_EMAIL_SEND_FAILED', publicId: 'SCH-X', reason: 'send_failed' }],
    },
  }).includes('FALHOU'),
);
assert.ok(
  storeNotifyCardHint({
    statusLabel: 'Pago',
    publicId: 'SCH-Y',
    mail: { configured: false, recipientCount: 0, recentFailures: [] },
  }).includes('não dispara e-mail'),
);

assert.ok(reconciliationsKpiHint(3).includes('revisar agora'));
assert.equal(reconciliationsKpiHint(0), 'nenhuma aberta');
assert.ok(emptyReconciliationsMessage({ openCount: 2, listed: 0 }).includes('atualize a lista'));
assert.equal(emptyReconciliationsMessage({ openCount: 0, listed: 0 }), 'Nenhuma reconciliação aberta.');

assert.equal(mailOpsKpiValue(null).value, '—');
assert.equal(mailOpsKpiValue({ configured: true, recipientCount: 1, failureCount: 0 }).value, 'Configurado');
assert.equal(mailOpsKpiValue({ configured: true, failureCount: 2 }).danger, true);
assert.equal(mailOpsKpiValue({ configured: false, providerOffWithStoreNotify: true }).value, 'Provider off');
assert.equal(mailOpsKpiValue({ configured: true, recipientCount: 0 }).value, 'Sem destinatário');

console.log('admin-ops-ui web unit ok');
