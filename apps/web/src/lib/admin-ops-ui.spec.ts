import assert from 'assert';
import {
  advanceSuccessMessage,
  copySuccessMessage,
  emptyOrdersQueueMessage,
  formatOpsSnapshotTime,
  opsAlertCtaHintPt,
  opsAlertDestination,
  opsAlertSeverityLabelPt,
  opsAttentionEmptyMessage,
  opsAttentionUnavailableMessage,
  opsCountOrDash,
  opsMailStatusLabel,
  opsQuickActionFigure,
  opsUploadsStatusLabel,
  OPS_ATTENTION_HEADING,
  OPS_DO_HEADING,
  OPS_DO_LEDE,
  OPS_NOW_HEADING,
  OPS_NOW_LEDE,
  OPS_QUICK_ACTIONS,
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
assert.equal(OPS_NOW_HEADING, 'O que está acontecendo agora?');
assert.equal(OPS_ATTENTION_HEADING, 'O que precisa de atenção?');
assert.equal(OPS_DO_HEADING, 'O que posso fazer agora?');
assert.ok(OPS_NOW_LEDE.includes('GET /admin/ops'));
assert.ok(OPS_DO_LEDE.includes('seções'));
assert.ok(OPS_QUICK_ACTIONS.some((a) => a.id === 'push' && /campanha/i.test(a.label)));
assert.ok(OPS_QUICK_ACTIONS.some((a) => a.id === 'catalog'));
assert.ok(OPS_QUICK_ACTIONS.some((a) => a.id === 'paid'));
assert.equal(opsQuickActionFigure('paid', null), null);
assert.equal(opsQuickActionFigure('paid', { paidAwaiting: 0 }), '0 no snapshot');
assert.equal(opsQuickActionFigure('push', { paidAwaiting: 4 }), null);
assert.equal(opsQuickActionFigure('recon', {}), null);
assert.equal(opsQuickActionFigure('recon', { openRecon: 2 }), '2 aberta(s)');
assert.equal(
  opsQuickActionFigure('catalog', { lowStock: 1, outOfStock: 0 }),
  'estoque baixo 1 · zerados 0',
);
assert.equal(opsCountOrDash(0, true), '0');
assert.equal(opsCountOrDash(null, true), '—');
assert.equal(opsCountOrDash(3, false), '—');
assert.equal(formatOpsSnapshotTime(null), '—');
assert.equal(formatOpsSnapshotTime('nope'), '—');
assert.notEqual(formatOpsSnapshotTime('2026-09-22T12:00:00.000Z'), '—');
assert.equal(opsMailStatusLabel(undefined, false).label, '—');
assert.equal(opsMailStatusLabel({ configured: true, storeNotifyFailureCount: 0 }, true).label, 'Configurado');
assert.equal(
  opsMailStatusLabel({ configured: false, providerOffWithStoreNotify: true }, true).label,
  'Provedor off',
);
assert.equal(opsMailStatusLabel({ configured: false }, true).label, 'Ausente');
assert.equal(opsMailStatusLabel({ configured: true, storeNotifyFailureCount: 2 }, true).label, '2 falha(s)');
assert.equal(opsUploadsStatusLabel(null), null);
assert.equal(opsUploadsStatusLabel({ persistent: true, dir: '/data/uploads' }), 'Volume persistente · /data/uploads');
assert.equal(opsUploadsStatusLabel({ persistent: false }), 'Disco efêmero');
assert.equal(opsAlertDestination({ code: 'out_of_stock', severity: 'critical' }).kind, 'catalog');
assert.equal(opsAlertDestination({ code: 'low_stock', severity: 'warn' }).kind, 'catalog');
assert.equal(
  opsAlertDestination({ code: 'paid_needs_organizing', severity: 'warn', queueBucket: 'paid' }).kind,
  'orders',
);
assert.deepEqual(opsAlertDestination({ code: 'uploads_ephemeral', severity: 'warn' }), { kind: 'none' });
assert.equal(opsAlertDestination({ code: 'mail_not_configured', severity: 'info' }).kind, 'none');
assert.equal(
  opsAlertDestination({
    code: 'store_notify_mail_failed',
    severity: 'high',
    section: 'mail',
    evidenceIds: ['SCH-9'],
  }).kind,
  'mail',
);
assert.equal(opsAlertCtaHintPt({ code: 'out_of_stock', severity: 'critical' }), '→ Catálogo (estoque)');
assert.equal(opsAlertCtaHintPt({ code: 'placeholder_photos', severity: 'info', section: 'catalog' }), '→ Catálogo (fotos)');
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
