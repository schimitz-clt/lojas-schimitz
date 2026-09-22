import assert from 'assert';
import {
  advanceSuccessMessage,
  copySuccessMessage,
  emptyOrdersQueueMessage,
  catalogoCommandCounts,
  catalogoNowSummary,
  catalogoQuickActionFigure,
  CATALOGO_DO_LEDE,
  CATALOGO_NOW_LEDE,
  CATALOGO_QUICK_ACTIONS,
  formatOpsSnapshotTime,
  opsAlertCtaHintPt,
  opsAlertDestination,
  opsAlertSeverityLabelPt,
  opsAttentionEmptyMessage,
  opsAttentionUnavailableMessage,
  partitionSectionAlerts,
  pedidosCommandCounts,
  pedidosNowSummary,
  pedidosQuickActionFigure,
  PEDIDOS_DO_LEDE,
  PEDIDOS_NOW_LEDE,
  PEDIDOS_QUICK_ACTIONS,
  snapshotListAlignmentNote,
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

assert.ok(PEDIDOS_NOW_LEDE.includes('GET /admin/ops'));
assert.ok(PEDIDOS_DO_LEDE.includes('buckets'));
assert.ok(CATALOGO_NOW_LEDE.includes('GET /admin/ops'));
assert.ok(CATALOGO_DO_LEDE.includes('CSV'));
assert.ok(PEDIDOS_QUICK_ACTIONS.some((a) => a.id === 'paid'));
assert.ok(PEDIDOS_QUICK_ACTIONS.some((a) => a.id === 'stuck'));
assert.ok(PEDIDOS_QUICK_ACTIONS.some((a) => a.id === 'no_shipping'));
assert.ok(CATALOGO_QUICK_ACTIONS.some((a) => a.id === 'stock'));
assert.ok(CATALOGO_QUICK_ACTIONS.some((a) => a.id === 'photos'));
assert.ok(CATALOGO_QUICK_ACTIONS.some((a) => a.id === 'csv'));

{
  const blank = pedidosCommandCounts(null, false);
  assert.equal(blank.ready, false);
  assert.equal(blank.paidAwaiting, null);
  assert.equal(blank.stuckPaid, null);
  assert.equal(blank.legacyStuck, null);
  assert.equal(blank.awaitingPayment, null);
  assert.equal(blank.buckets, null);
  assert.equal(opsCountOrDash(blank.paidAwaiting, blank.ready), '—');
  assert.equal(opsCountOrDash(blank.stuckPaid, blank.ready), '—');
  assert.equal(pedidosQuickActionFigure('paid', blank), null);
  assert.equal(pedidosQuickActionFigure('stuck', blank), null);
  assert.equal(pedidosQuickActionFigure('no_shipping', blank), null);
  assert.equal(pedidosNowSummary(blank, 'pending'), 'Lendo o snapshot…');
  const unavailable = pedidosNowSummary(blank, 'error');
  assert.ok(unavailable.includes('indisponível'));
  assert.equal(/\d/.test(unavailable), false);

  const catalogBlank = catalogoCommandCounts(undefined, false);
  assert.equal(catalogBlank.lowStock, null);
  assert.equal(catalogBlank.outOfStock, null);
  assert.equal(catalogBlank.placeholderPhotos, null);
  assert.equal(opsCountOrDash(catalogBlank.lowStock, catalogBlank.ready), '—');
  assert.equal(catalogoQuickActionFigure('photos', catalogBlank), null);
  assert.equal(catalogoQuickActionFigure('stock', catalogBlank), null);
  assert.equal(catalogoNowSummary(catalogBlank, 'pending'), 'Lendo o snapshot…');
  assert.equal(/\d/.test(catalogoNowSummary(catalogBlank, 'error')), false);
  assert.equal(snapshotListAlignmentNote(null, 4, false), null);
  assert.equal(snapshotListAlignmentNote(null, 4, true), null);
}

{
  const zero = pedidosCommandCounts(
    {
      orders: {
        total: 0,
        stuckCount: 0,
        buckets: { paid: 0, awaiting_payment: 0, problems: 0 },
      },
      paidAwaitingOrg: {
        paidAwaitingCount: 0,
        stuckCount: 0,
        stuckHoursThreshold: 24,
        oldestStuckHours: null,
        stuckPublicIds: [],
      },
    },
    true,
  );
  assert.equal(zero.paidAwaiting, 0);
  assert.equal(zero.stuckPaid, 0);
  assert.equal(zero.legacyStuck, 0);
  assert.equal(opsCountOrDash(zero.paidAwaiting, true), '0');
  assert.equal(opsCountOrDash(zero.stuckPaid, true), '0');
  assert.equal(pedidosQuickActionFigure('paid', zero), '0 no snapshot');
  assert.equal(zero.oldestStuckHours, null);
  assert.deepEqual(zero.stuckPublicIds, []);

  const partial = pedidosCommandCounts({ orders: { total: 3 } }, true);
  assert.equal(partial.total, 3);
  assert.equal(partial.paidAwaiting, null);
  assert.equal(partial.stuckPaid, null);
  assert.equal(partial.buckets, null);
  assert.equal(opsCountOrDash(partial.paidAwaiting, true), '—');
  assert.equal(pedidosQuickActionFigure('paid', partial), null);
  assert.ok(pedidosNowSummary(partial, 'ready').includes('não trouxe'));
  assert.equal(/\d/.test(pedidosNowSummary(partial, 'ready')), false);

  const catalogZero = catalogoCommandCounts(
    {
      inventory: { lowStockCount: 0, outOfStockCount: 0, lowStockThreshold: 5 },
      catalog: { placeholderProductCount: 0 },
    },
    true,
  );
  assert.equal(catalogZero.lowStock, 0);
  assert.equal(catalogZero.outOfStock, 0);
  assert.equal(catalogZero.placeholderPhotos, 0);
  assert.equal(opsCountOrDash(catalogZero.outOfStock, true), '0');
  assert.equal(catalogoQuickActionFigure('stock', catalogZero), 'baixo 0 · zerados 0');
  assert.equal(catalogoQuickActionFigure('photos', catalogZero), '0 no snapshot');
  assert.equal(catalogoQuickActionFigure('csv', catalogZero), null);
  assert.equal(snapshotListAlignmentNote(2, 2, true), 'Lista carregada: 2 · igual ao snapshot.');
  assert.ok(snapshotListAlignmentNote(7, 1, true)?.includes('snapshot: 7'));

  const catalogPartial = catalogoCommandCounts({ inventory: { lowStockCount: 4 } }, true);
  assert.equal(catalogPartial.lowStock, 4);
  assert.equal(catalogPartial.outOfStock, null);
  assert.equal(catalogPartial.placeholderPhotos, null);
  assert.equal(opsCountOrDash(catalogPartial.placeholderPhotos, true), '—');
  assert.equal(catalogoQuickActionFigure('stock', catalogPartial), 'baixo 4');
  assert.equal(catalogoQuickActionFigure('photos', catalogPartial), null);
}

{
  const sample = [
    { code: 'open_reconciliations', severity: 'high', section: 'reconciliations' },
    { code: 'paid_stuck_awaiting_org', severity: 'high', queueBucket: 'paid' },
    { code: 'paid_needs_organizing', severity: 'warn', queueBucket: 'paid' },
    { code: 'low_stock', severity: 'warn' },
    { code: 'out_of_stock', severity: 'critical' },
    { code: 'placeholder_photos', severity: 'info', section: 'catalog' },
    { code: 'awaiting_payment_orders', severity: 'info', queueBucket: 'awaiting_payment' },
    { code: 'order_problems', severity: 'critical', queueBucket: 'problems' },
    { code: 'uploads_ephemeral', severity: 'warn' },
    { code: 'store_notify_mail_failed', severity: 'high', section: 'mail' },
  ];
  const pedidos = partitionSectionAlerts(sample, 'pedidos');
  assert.deepEqual(
    pedidos.attention.map((a) => a.code),
    ['store_notify_mail_failed', 'order_problems', 'paid_stuck_awaiting_org', 'paid_needs_organizing'],
  );
  assert.deepEqual(pedidos.signals.map((a) => a.code), ['awaiting_payment_orders']);
  assert.equal(pedidos.attention.some((a) => a.code === 'low_stock'), false);
  assert.equal(pedidos.attention.some((a) => a.code === 'open_reconciliations'), false);
  const catalogo = partitionSectionAlerts(sample, 'catalogo');
  assert.deepEqual(catalogo.attention.map((a) => a.code), [
    'out_of_stock',
    'low_stock',
    'placeholder_photos',
  ]);
  assert.deepEqual(catalogo.signals, []);
  assert.equal(partitionSectionAlerts(null, 'pedidos').attention.length, 0);
  assert.equal(partitionSectionAlerts(undefined, 'catalogo').attention.length, 0);

  for (const alert of pedidos.attention) {
    const dest = opsAlertDestination(alert);
    assert.ok(dest.kind === 'orders' || dest.kind === 'mail', alert.code);
  }
  for (const alert of catalogo.attention) {
    const dest = opsAlertDestination(alert);
    assert.ok(dest.kind === 'catalog' || dest.kind === 'catalog_photos', alert.code);
  }
  assert.equal(
    opsAlertDestination({ code: 'paid_needs_organizing', severity: 'warn', queueBucket: 'paid' }).kind,
    'orders',
  );
  assert.equal(opsAlertDestination({ code: 'out_of_stock', severity: 'critical' }).kind, 'catalog');
  assert.equal(
    opsAlertDestination({ code: 'placeholder_photos', severity: 'info', section: 'catalog' }).kind,
    'catalog_photos',
  );
}
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
