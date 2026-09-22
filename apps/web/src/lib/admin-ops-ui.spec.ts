import assert from 'assert';
import {
  advanceSuccessMessage,
  copySuccessMessage,
  emptyOrdersQueueMessage,
  opsAlertCtaHintPt,
  opsAlertSeverityLabelPt,
  opsAttentionEmptyMessage,
  opsAttentionUnavailableMessage,
  OPS_ATTENTION_HEADING,
  paymentMethodBadge,
  paymentMethodLabelPt,
  pickPrimaryPayment,
  separarPrimaryLabel,
  sortOpsAlertsForAttention,
  storePaidNotifyCardHint,
  storePaidNotifyResultMessage,
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

assert.equal(opsAlertSeverityLabelPt('critical'), 'CRÍTICO');
assert.equal(opsAlertSeverityLabelPt('high'), 'URGENTE');
assert.equal(opsAlertSeverityLabelPt('warn'), 'ATENÇÃO');
assert.equal(opsAlertSeverityLabelPt('info'), 'INFO');
assert.equal(OPS_ATTENTION_HEADING, 'O que precisa de atenção?');
assert.equal(opsAttentionEmptyMessage(0), 'Nada precisa de atenção neste snapshot.');
assert.ok(opsAttentionEmptyMessage(2).includes('informativos'));
assert.ok(opsAttentionUnavailableMessage().includes('GET /admin/ops'));
assert.equal(/\d/.test(opsAttentionUnavailableMessage()), false);

assert.ok(
  opsAlertCtaHintPt({ code: 'open_reconciliations', severity: 'high', section: 'reconciliations' })?.includes(
    'Reconciliações',
  ),
);
assert.ok(
  opsAlertCtaHintPt({ code: 'store_notify_mail_failed', severity: 'high', section: 'mail' })?.includes('reenviar'),
);

{
  const sorted = sortOpsAlertsForAttention([
    { code: 'low_stock', severity: 'warn' },
    { code: 'open_reconciliations', severity: 'high' },
    { code: 'store_notify_mail_failed', severity: 'high' },
    { code: 'out_of_stock', severity: 'critical' },
  ]);
  assert.equal(sorted[0].code, 'open_reconciliations');
  assert.equal(sorted[1].code, 'store_notify_mail_failed');
}

assert.ok(
  storePaidNotifyResultMessage({
    publicId: 'SCH-1',
    emailsAttempted: 1,
    emailsSent: 1,
    inAppCreated: 2,
    mailOutcome: 'sent',
  }).includes('enviado'),
);
assert.ok(
  storePaidNotifyResultMessage({
    publicId: 'SCH-2',
    emailsAttempted: 0,
    emailsSent: 0,
    inAppCreated: 1,
    mailOutcome: 'no_recipients',
  }).includes('NÃO tentado'),
);
assert.ok(
  storePaidNotifyResultMessage({
    publicId: 'SCH-3',
    emailsAttempted: 1,
    emailsSent: 0,
    inAppCreated: 1,
    mailOutcome: 'send_failed',
  }).includes('FALHOU'),
);
assert.ok(
  storePaidNotifyResultMessage({
    publicId: 'SCH-4',
    emailsAttempted: 1,
    emailsSent: 0,
    inAppCreated: 1,
    mailOutcome: 'provider_off',
    mailReason: 'smtp_not_configured',
  }).includes('provedor desligado'),
);
assert.ok(
  storePaidNotifyResultMessage({
    publicId: 'SCH-LEG',
    emailsAttempted: 0,
    inAppCreated: 1,
  }).includes('NÃO tentado'),
);

assert.equal(
  storePaidNotifyCardHint({ orderPublicId: 'SCH-1', lastFailure: { publicId: 'SCH-OTHER' } }),
  null,
);
assert.ok(
  storePaidNotifyCardHint({
    orderPublicId: 'SCH-1',
    lastFailure: { publicId: 'SCH-1', event: 'STORE_EMAIL_SEND_FAILED' },
  })?.includes('FALHOU'),
);
assert.ok(
  storePaidNotifyCardHint({
    orderPublicId: 'SCH-1',
    lastFailure: { publicId: 'SCH-1', event: 'STORE_EMAIL_NO_RECIPIENTS' },
  })?.includes('NÃO foi tentado'),
);

console.log('admin-ops-ui web unit ok');
