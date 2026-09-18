import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DEFAULT_OPS_LOW_STOCK_THRESHOLD,
  PAID_STUCK_HOURS,
  countPlaceholderProducts,
  deriveOpsAlerts,
  hoursSince,
  isLowOnHand,
  isMissingOrPlaceholderImage,
  isPaidStuck,
  isPlaceholderImageUrl,
  listPlaceholderProducts,
  paidStuckSeverity,
  placeholderPhotoReason,
  placeholderProductsCsv,
  summarizeInventoryOps,
  summarizeOps,
  summarizeOrderStatusCounts,
  summarizePaidAwaitingOrg,
  summarizeReconciliations,
  summarizeSalesWindow,
  summarizeStoreNotifyMailOps,
  summarizeUploadsDurability,
  sortOpsAlertsForAttention,
  resolveUploadsDir,
  isUploadsDirPersistent,
  UPLOADS_PERSISTENT_ROOT,
} from './admin-ops';

assert.equal(DEFAULT_OPS_LOW_STOCK_THRESHOLD, 5);
assert.equal(isLowOnHand(0), true);
assert.equal(isLowOnHand(5), true);
assert.equal(isLowOnHand(6), false);
assert.equal(isLowOnHand(null), false);
assert.equal(isLowOnHand(undefined), false);
assert.equal(isLowOnHand(3, 2), false);
assert.equal(isLowOnHand(2, 2), true);

const snap = summarizeInventoryOps({
  lowStockCount: 4,
  outOfStockCount: 1,
  time: '2026-09-12T00:00:00.000Z',
});
assert.equal(snap.inventory.lowStockThreshold, 5);
assert.equal(snap.inventory.lowStockCount, 4);
assert.equal(snap.inventory.outOfStockCount, 1);
assert.equal(snap.time, '2026-09-12T00:00:00.000Z');

assert.equal(isPlaceholderImageUrl('https://placehold.co/600x400'), true);
assert.equal(isPlaceholderImageUrl('https://via.placeholder.com/800'), true);
assert.equal(isPlaceholderImageUrl('https://cdn.lojasschimitz.com.br/x.png'), false);
assert.equal(isMissingOrPlaceholderImage(''), true);
assert.equal(isMissingOrPlaceholderImage(null), true);
assert.equal(isMissingOrPlaceholderImage('https://lojasschimitz.com.br/api/v1/uploads/a.png'), false);

assert.equal(
  countPlaceholderProducts([
    { images: [] },
    { images: [{ url: 'https://placehold.co/1' }] },
    { images: [{ url: 'https://lojasschimitz.com.br/api/v1/uploads/ok.png' }] },
    { images: null },
  ]),
  3,
);

const full = summarizeOps({
  lowStockCount: 2,
  outOfStockCount: 1,
  placeholderProductCount: 7,
  pendingPaymentCount: 3,
  time: '2026-09-12T15:00:00.000Z',
});
assert.equal(full.inventory.lowStockCount, 2);
assert.equal(full.catalog.placeholderProductCount, 7);
assert.deepEqual(full.catalog.placeholderProducts, []);
assert.equal(full.payments.pendingCount, 3);
assert.equal(full.mail.configured, false);
assert.equal(full.time, '2026-09-12T15:00:00.000Z');
assert.equal(full.reconciliations.openCount, 0);
assert.deepEqual(full.reconciliations.recent, []);

const listed = listPlaceholderProducts([
  { id: 'a', name: 'Roblox', images: [{ url: 'https://placehold.co/1' }] },
  { id: 'b', name: 'Real', images: [{ url: 'https://lojasschimitz.com.br/api/v1/uploads/ok.png' }] },
  { id: 'c', name: 'Sem foto', images: [] },
]);
assert.deepEqual(listed, [
  { id: 'a', name: 'Roblox', imageUrl: 'https://placehold.co/1', reason: 'placeholder' },
  { id: 'c', name: 'Sem foto', imageUrl: '', reason: 'missing' },
]);

const csv = placeholderProductsCsv(listed);
assert.equal(csv.filename, 'products-needing-photos.csv');
assert.ok(csv.csv.startsWith('id,name,imageUrl,reason\n'));
assert.ok(csv.csv.includes('a,Roblox,https://placehold.co/1,placeholder'));
assert.ok(csv.csv.includes('c,Sem foto,,missing'));
assert.ok(!csv.csv.includes('fake-photo'));

const withList = summarizeOps({
  lowStockCount: 0,
  outOfStockCount: 0,
  placeholderProductCount: listed.length,
  placeholderProducts: listed,
  pendingPaymentCount: 0,
  time: '2026-09-12T18:00:00.000Z',
  mailConfigured: true,
});
assert.equal(withList.catalog.placeholderProductCount, 2);
assert.equal(withList.catalog.placeholderProducts[0].id, 'a');
assert.equal(withList.catalog.placeholderProducts[1].name, 'Sem foto');
assert.equal(withList.mail.configured, true);

const orderCounts = summarizeOrderStatusCounts([
  { status: 'paid', count: 2 },
  { status: 'organizing', count: 1 },
  { status: 'cancelled', count: 3 },
  { status: 'shipped', count: 1 },
  { status: 'awaiting_payment', count: 4 },
]);
assert.equal(orderCounts.byStatus.paid, 2);
assert.equal(orderCounts.buckets.paid, 2);
assert.equal(orderCounts.buckets.organizing, 1);
assert.equal(orderCounts.buckets.awaiting_payment, 4);
assert.equal(orderCounts.buckets.problems, 4); // cancelled 3 + shipped 1 (Pedidos filter)
assert.equal(orderCounts.stuckCount, 1); // shipped only — CRITICAL source
assert.equal(orderCounts.terminalHistoryCount, 3); // cancelled — not critical
assert.deepEqual([...orderCounts.stuckStatuses], ['separating', 'shipped']);
assert.deepEqual([...orderCounts.terminalHistoryStatuses], ['cancelled', 'refunded']);
assert.equal(orderCounts.total, 11);

const withOrders = summarizeOps({
  lowStockCount: 0,
  outOfStockCount: 0,
  placeholderProductCount: 0,
  pendingPaymentCount: 0,
  orderStatusCounts: [
    { status: 'paid', count: 5 },
    { status: 'delivered', count: 2 },
  ],
  mailConfigured: false,
});
assert.equal(withOrders.orders.buckets.paid, 5);
assert.equal(withOrders.orders.buckets.delivered, 2);
assert.equal(withOrders.orders.total, 7);


const salesWin = summarizeSalesWindow({
  from: '2026-09-12',
  to: '2026-09-12',
  orderCount: 2,
  revenue: 199.995,
});
assert.equal(salesWin.orderCount, 2);
assert.equal(salesWin.revenue, 200);
assert.equal(salesWin.from, '2026-09-12');

const emptyAlerts = deriveOpsAlerts({
  lowStockCount: 0,
  outOfStockCount: 0,
  placeholderProductCount: 0,
  pendingPaymentCount: 0,
  mailConfigured: true,
  orderBuckets: {},
});
assert.deepEqual(emptyAlerts, []);

const richAlerts = deriveOpsAlerts({
  lowStockCount: 3,
  outOfStockCount: 1,
  placeholderProductCount: 2,
  pendingPaymentCount: 4,
  mailConfigured: false,
  orderBuckets: { paid: 5, problems: 2, awaiting_payment: 4 },
  stuckOrderCount: 2,
});
assert.equal(richAlerts.some((a) => a.code === 'out_of_stock' && a.severity === 'critical'), true);
assert.equal(richAlerts.some((a) => a.code === 'low_stock' && a.count === 3), true);
assert.equal(richAlerts.some((a) => a.code === 'pending_payments' && a.queueBucket === 'awaiting_payment'), true);
assert.equal(richAlerts.some((a) => a.code === 'paid_needs_organizing' && a.queueBucket === 'paid'), true);
assert.equal(richAlerts.some((a) => a.code === 'order_problems' && a.severity === 'critical'), true);
assert.equal(richAlerts.some((a) => a.code === 'placeholder_photos'), true);
assert.equal(
  richAlerts.find((a) => a.code === 'placeholder_photos')?.section,
  'catalog',
);
assert.equal(richAlerts.some((a) => a.code === 'mail_not_configured'), true);
assert.equal(richAlerts.some((a) => a.code === 'awaiting_payment_orders'), true);

{
  // buckets.problems includes cancelled/refunded — must NOT drive CRITICAL by itself
  const problemsBucketOnly = deriveOpsAlerts({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
    orderBuckets: { problems: 22 },
  });
  assert.equal(
    problemsBucketOnly.some((a) => a.code === 'order_problems'),
    false,
    'buckets.problems alone must not emit critical order_problems',
  );
  assert.equal(problemsBucketOnly.some((a) => a.severity === 'critical'), false);
}

const dash = summarizeOps({
  lowStockCount: 1,
  outOfStockCount: 0,
  placeholderProductCount: 0,
  pendingPaymentCount: 2,
  orderStatusCounts: [
    { status: 'paid', count: 3 },
    { status: 'awaiting_payment', count: 2 },
  ],
  mailConfigured: true,
  salesToday: salesWin,
  salesLast30d: summarizeSalesWindow({
    from: '2026-08-14',
    to: '2026-09-12',
    orderCount: 10,
    revenue: 1500,
  }),
});
assert.equal(dash.sales.today?.revenue, 200);
assert.equal(dash.sales.last30d?.orderCount, 10);
assert.equal(dash.alerts.some((a) => a.code === 'paid_needs_organizing' && a.count === 3), true);
assert.equal(dash.alerts.some((a) => a.code === 'pending_payments' && a.count === 2), true);
assert.equal(dash.mail.configured, true);
assert.equal(dash.orders.buckets.paid, 3);


const reconSum = summarizeReconciliations({
  openCount: 2,
  recent: [
    {
      id: 'r1',
      reason: 'orphan_approved',
      providerStatus: 'approved',
      externalReference: 'SCH-ABC',
      createdAt: '2026-09-16T12:00:00.000Z',
      status: 'RECONCILIATION_REQUIRED',
    },
    {
      id: 'r2',
      reason: 'orphan_pending',
      providerStatus: 'pending',
      externalReference: null,
      createdAt: new Date('2026-09-16T11:00:00.000Z'),
      status: 'RECONCILIATION_REQUIRED',
    },
  ],
});
assert.equal(reconSum.openCount, 2);
assert.equal(reconSum.recent.length, 2);
assert.equal(reconSum.recent[0].externalReference, 'SCH-ABC');
assert.equal(reconSum.recent[1].createdAt, '2026-09-16T11:00:00.000Z');

const reconAlerts = deriveOpsAlerts({
  lowStockCount: 0,
  outOfStockCount: 0,
  placeholderProductCount: 0,
  pendingPaymentCount: 0,
  mailConfigured: true,
  orderBuckets: {},
  openReconciliationCount: 2,
  reconciliationRecent: reconSum.recent,
});
const reconAlert = reconAlerts.find((a) => a.code === 'open_reconciliations');
assert.ok(reconAlert);
assert.equal(reconAlert!.severity, 'high');
assert.equal(reconAlert!.count, 2);
assert.equal(reconAlert!.section, 'reconciliations');
assert.equal(reconAlert!.evidence?.reason, 'orphan_approved');
assert.ok(reconAlert!.message.includes('ABERTA'));
assert.ok(reconAlert!.message.toLowerCase().includes('estorno'));
assert.ok(reconAlert!.recommendedAction?.includes('Abrir fila Reconciliações'));
assert.ok(reconAlert!.recommendedAction?.toLowerCase().includes('nunca estornar'));

const withRecon = summarizeOps({
  lowStockCount: 0,
  outOfStockCount: 0,
  placeholderProductCount: 0,
  pendingPaymentCount: 0,
  mailConfigured: true,
  reconciliations: reconSum,
});
assert.equal(withRecon.reconciliations.openCount, 2);
assert.equal(withRecon.alerts.some((a) => a.code === 'open_reconciliations' && a.severity === 'high'), true);
assert.equal(withRecon.alerts.find((a) => a.code === 'open_reconciliations')?.evidence?.ids?.[0], 'r1');

const noReconAlert = deriveOpsAlerts({
  lowStockCount: 0,
  outOfStockCount: 0,
  placeholderProductCount: 0,
  pendingPaymentCount: 0,
  mailConfigured: true,
  openReconciliationCount: 0,
});
assert.equal(noReconAlert.some((a) => a.code === 'open_reconciliations'), false);


assert.equal(PAID_STUCK_HOURS, 24);
assert.equal(placeholderPhotoReason(''), 'missing');
assert.equal(placeholderPhotoReason('https://placehold.co/1'), 'placeholder');

{
  const now = new Date('2026-09-16T18:00:00.000Z');
  assert.equal(hoursSince('2026-09-16T12:00:00.000Z', now), 6);
  assert.equal(isPaidStuck('2026-09-15T17:00:00.000Z', 24, now), true); // 25h
  assert.equal(isPaidStuck('2026-09-15T19:00:00.000Z', 24, now), false); // 23h
  assert.equal(paidStuckSeverity(0, null), 'info');
  assert.equal(paidStuckSeverity(1, 24), 'high');
  assert.equal(paidStuckSeverity(1, 48), 'critical');
  assert.equal(paidStuckSeverity(5, 24), 'critical');
}

{
  const now = new Date('2026-09-16T18:00:00.000Z');
  const sum = summarizePaidAwaitingOrg({
    now,
    orders: [
      { id: '1', publicId: 'SCH-A', since: '2026-09-15T12:00:00.000Z' }, // 30h stuck
      { id: '2', publicId: 'SCH-B', since: '2026-09-16T12:00:00.000Z' }, // 6h ok
      { id: '3', publicId: 'SCH-C', since: '2026-09-14T18:00:00.000Z' }, // 48h stuck
    ],
  });
  assert.equal(sum.paidAwaitingCount, 3);
  assert.equal(sum.stuckCount, 2);
  assert.equal(sum.stuckHoursThreshold, 24);
  assert.equal(sum.oldestStuckHours, 48);
  assert.deepEqual(sum.stuckPublicIds, ['SCH-C', 'SCH-A']); // oldest first
}

{
  const stuckSum = summarizePaidAwaitingOrg({
    now: new Date('2026-09-16T18:00:00.000Z'),
    orders: [
      { id: '1', publicId: 'SCH-STUCK', since: '2026-09-15T10:00:00.000Z' },
    ],
  });
  const alerts = deriveOpsAlerts({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
    orderBuckets: { paid: 1 },
    paidAwaitingOrg: stuckSum,
  });
  assert.equal(alerts.some((a) => a.code === 'paid_needs_organizing'), true);
  const stuck = alerts.find((a) => a.code === 'paid_stuck_awaiting_org');
  assert.ok(stuck);
  assert.equal(stuck!.severity, 'high');
  assert.equal(stuck!.queueBucket, 'paid');
  assert.ok(stuck!.evidence?.ids?.includes('SCH-STUCK'));
  assert.ok(stuck!.recommendedAction?.includes('Separar'));
}

{
  const withStuck = summarizeOps({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
    orderStatusCounts: [{ status: 'paid', count: 2 }],
    paidAwaitingOrg: summarizePaidAwaitingOrg({
      now: new Date('2026-09-16T18:00:00.000Z'),
      orders: [
        { id: 'x', publicId: 'SCH-X', since: '2026-09-14T18:00:00.000Z' },
        { id: 'y', publicId: 'SCH-Y', since: '2026-09-16T17:00:00.000Z' },
      ],
    }),
  });
  assert.equal(withStuck.paidAwaitingOrg.stuckCount, 1);
  assert.equal(withStuck.paidAwaitingOrg.paidAwaitingCount, 2);
  assert.equal(
    withStuck.alerts.some((a) => a.code === 'paid_stuck_awaiting_org' && a.severity === 'critical'),
    true,
  ); // 48h → critical
}


console.log('admin-ops unit tests ok');

{
  const mismatch = deriveOpsAlerts({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: false,
    storeNotifyConfigured: true,
  });
  assert.equal(mismatch.some((a) => a.code === 'mail_off_with_store_notify'), true);
  assert.equal(mismatch.some((a) => a.code === 'mail_not_configured'), false, 'prefer mismatch warn over generic info');

  const ops = summarizeOps({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: false,
    storeNotifyConfigured: true,
  });
  assert.equal(ops.mail.configured, false);
  assert.equal(ops.mail.storeNotifyConfigured, true);
  assert.equal(ops.mail.providerOffWithStoreNotify, true);
  console.log('admin-ops: mail_off_with_store_notify — PASSOU');
}


{
  assert.equal(UPLOADS_PERSISTENT_ROOT, '/data');
  assert.equal(isUploadsDirPersistent('/data/uploads'), true);
  assert.equal(isUploadsDirPersistent('/data'), true);
  assert.equal(isUploadsDirPersistent('/data/uploads/'), true);
  assert.equal(isUploadsDirPersistent('/datafoo'), false);
  assert.equal(isUploadsDirPersistent('/tmp/uploads'), false);
  assert.equal(isUploadsDirPersistent('uploads'), false);
  assert.equal(isUploadsDirPersistent(''), false);
  assert.equal(resolveUploadsDir('/data/uploads'), '/data/uploads');
  assert.equal(resolveUploadsDir(undefined, '/app'), '/app/uploads');
  assert.equal(resolveUploadsDir('', '/workspace/api'), '/workspace/api/uploads');
  assert.equal(resolveUploadsDir('  /data/uploads  '), '/data/uploads');

  const durable = summarizeUploadsDurability({ envDir: '/data/uploads' });
  assert.equal(durable.persistent, true);
  assert.equal(durable.dir, '/data/uploads');

  const ephemeral = summarizeUploadsDurability({ envDir: null, cwd: '/app' });
  assert.equal(ephemeral.persistent, false);
  assert.equal(ephemeral.dir, '/app/uploads');

  const noAlert = deriveOpsAlerts({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
    uploadsPersistent: true,
  });
  assert.equal(noAlert.some((a) => a.code === 'uploads_ephemeral'), false);

  const skipUnset = deriveOpsAlerts({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
  });
  assert.equal(skipUnset.some((a) => a.code === 'uploads_ephemeral'), false, 'undefined uploadsPersistent must not invent alert');

  const ephAlert = deriveOpsAlerts({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
    uploadsPersistent: false,
    uploadsDir: '/app/uploads',
  });
  const ua = ephAlert.find((a) => a.code === 'uploads_ephemeral');
  assert.ok(ua);
  assert.equal(ua!.severity, 'warn');
  assert.ok(ua!.message.includes('/data'));
  assert.ok(ua!.recommendedAction?.includes('Volume'));

  const opsEph = summarizeOps({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
    uploads: ephemeral,
  });
  assert.equal(opsEph.uploads?.persistent, false);
  assert.equal(opsEph.alerts.some((a) => a.code === 'uploads_ephemeral' && a.severity === 'warn'), true);

  const opsOk = summarizeOps({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
    uploads: durable,
  });
  assert.equal(opsOk.uploads?.persistent, true);
  assert.equal(opsOk.alerts.some((a) => a.code === 'uploads_ephemeral'), false);

  const opsOmit = summarizeOps({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
  });
  assert.equal(opsOmit.uploads, null);
  assert.equal(opsOmit.alerts.some((a) => a.code === 'uploads_ephemeral'), false);

  console.log('admin-ops: uploads_ephemeral durability — PASSOU');
}

{
  // Production 2026-09-17: 22 cancelled, zero stuck — no CRITICAL problemas
  const cancelledOnly = summarizeOps({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
    orderStatusCounts: [
      { status: 'cancelled', count: 22 },
      { status: 'refunded', count: 0 },
      { status: 'separating', count: 0 },
      { status: 'shipped', count: 0 },
    ],
  });
  assert.equal(cancelledOnly.orders.buckets.problems, 22);
  assert.equal(cancelledOnly.orders.stuckCount, 0);
  assert.equal(cancelledOnly.orders.terminalHistoryCount, 22);
  assert.equal(
    cancelledOnly.alerts.some((a) => a.code === 'order_problems'),
    false,
    'cancelled-only must not emit critical order_problems',
  );
  const hist = cancelledOnly.alerts.find((a) => a.code === 'order_terminal_history');
  assert.ok(hist);
  assert.equal(hist!.severity, 'info');
  assert.equal(hist!.count, 22);
  assert.equal(hist!.queueBucket, 'problems');
  assert.equal(cancelledOnly.alerts.some((a) => a.severity === 'critical'), false);
  assert.equal(cancelledOnly.alerts.some((a) => a.code === 'paid_needs_organizing'), false);

  const refundedOnly = summarizeOps({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
    orderStatusCounts: [{ status: 'refunded', count: 4 }],
  });
  assert.equal(refundedOnly.orders.stuckCount, 0);
  assert.equal(refundedOnly.alerts.some((a) => a.code === 'order_problems'), false);
  assert.equal(
    refundedOnly.alerts.some((a) => a.code === 'order_terminal_history' && a.severity === 'info' && a.count === 4),
    true,
  );

  const stuckLive = summarizeOps({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
    orderStatusCounts: [
      { status: 'separating', count: 1 },
      { status: 'shipped', count: 2 },
      { status: 'cancelled', count: 22 },
    ],
  });
  const op = stuckLive.alerts.find((a) => a.code === 'order_problems');
  assert.ok(op);
  assert.equal(op!.severity, 'critical');
  assert.equal(op!.count, 3, 'CRITICAL counts only separating+shipped');
  assert.equal(op!.queueBucket, 'problems');
  assert.ok(op!.message.includes('legado'));
  assert.equal(stuckLive.orders.stuckCount, 3);
  assert.equal(stuckLive.orders.terminalHistoryCount, 22);
  assert.equal(stuckLive.orders.buckets.problems, 25);
  assert.equal(
    stuckLive.alerts.find((a) => a.code === 'order_terminal_history')?.count,
    22,
  );

  const paidUnchanged = summarizeOps({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
    orderStatusCounts: [
      { status: 'paid', count: 5 },
      { status: 'cancelled', count: 22 },
    ],
  });
  const paidAlert = paidUnchanged.alerts.find((a) => a.code === 'paid_needs_organizing');
  assert.ok(paidAlert);
  assert.equal(paidAlert!.severity, 'warn');
  assert.equal(paidAlert!.count, 5);
  assert.equal(paidAlert!.queueBucket, 'paid');
  assert.equal(paidUnchanged.alerts.some((a) => a.code === 'order_problems'), false);

  console.log('admin-ops: stuck vs terminal history order_problems — PASSOU');
}

{
  assert.deepEqual(summarizeStoreNotifyMailOps(), { last: null, openCount: 0 });
  assert.deepEqual(summarizeStoreNotifyMailOps({ last: null, openCount: 3 }), {
    last: null,
    openCount: 0,
  });

  const mailSnap = summarizeStoreNotifyMailOps({
    last: {
      at: new Date('2026-09-18T12:00:00.000Z'),
      publicId: 'SCH-MAIL1',
      orderId: 'ord-1',
      event: 'STORE_EMAIL_SEND_FAILED',
      reason: 'send_failed',
      mode: 'resend-http',
    },
    openCount: 2,
  });
  assert.equal(mailSnap.openCount, 2);
  assert.equal(mailSnap.last?.publicId, 'SCH-MAIL1');
  assert.equal(mailSnap.last?.event, 'STORE_EMAIL_SEND_FAILED');

  const mailAlerts = deriveOpsAlerts({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
    storeNotifyMail: mailSnap,
  });
  const mailAlert = mailAlerts.find((a) => a.code === 'store_notify_mail_failed');
  assert.ok(mailAlert);
  assert.equal(mailAlert!.severity, 'high');
  assert.equal(mailAlert!.count, 2);
  assert.equal(mailAlert!.section, 'mail');
  assert.ok(mailAlert!.message.includes('SCH-MAIL1'));
  assert.ok(mailAlert!.message.includes('FALHOU') || mailAlert!.message.includes('falhou'));
  assert.ok(mailAlert!.recommendedAction?.includes('Reenviar'));
  assert.ok(mailAlert!.recommendedAction?.toLowerCase().includes('não foi revertido'));

  const noRecipients = deriveOpsAlerts({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
    storeNotifyMail: summarizeStoreNotifyMailOps({
      last: {
        at: '2026-09-18T12:00:00.000Z',
        publicId: 'SCH-NONE',
        event: 'STORE_EMAIL_NO_RECIPIENTS',
        reason: 'no_recipients',
      },
      openCount: 1,
    }),
  });
  const none = noRecipients.find((a) => a.code === 'store_notify_mail_failed');
  assert.ok(none);
  assert.ok(none!.message.includes('NÃO tentado') || none!.message.includes('nenhum destinatário'));

  const opsMail = summarizeOps({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
    storeNotifyMail: mailSnap,
  });
  assert.equal(opsMail.mail.lastStoreNotifyFailure?.publicId, 'SCH-MAIL1');
  assert.equal(opsMail.mail.storeNotifyFailureCount, 2);
  assert.equal(
    opsMail.alerts.some((a) => a.code === 'store_notify_mail_failed' && a.severity === 'high'),
    true,
  );

  const emptyMail = summarizeOps({
    lowStockCount: 0,
    outOfStockCount: 0,
    placeholderProductCount: 0,
    pendingPaymentCount: 0,
    mailConfigured: true,
  });
  assert.equal(emptyMail.mail.lastStoreNotifyFailure, null);
  assert.equal(emptyMail.mail.storeNotifyFailureCount, 0);
  assert.equal(emptyMail.alerts.some((a) => a.code === 'store_notify_mail_failed'), false);

  // Recon + mail beat stock/pending so they survive ATENÇÃO AGORA cap
  const crowded = deriveOpsAlerts({
    lowStockCount: 3,
    outOfStockCount: 1,
    placeholderProductCount: 0,
    pendingPaymentCount: 4,
    mailConfigured: true,
    orderBuckets: { paid: 5 },
    stuckOrderCount: 2,
    openReconciliationCount: 1,
    reconciliationRecent: reconSum.recent,
    storeNotifyMail: mailSnap,
  });
  assert.equal(crowded[0]?.code, 'open_reconciliations');
  assert.equal(crowded[1]?.code, 'store_notify_mail_failed');
  const sorted = sortOpsAlertsForAttention([
    { code: 'low_stock', severity: 'warn', message: 'x', count: 1 },
    { code: 'open_reconciliations', severity: 'high', message: 'r', count: 1, section: 'reconciliations' },
    { code: 'out_of_stock', severity: 'critical', message: 'z', count: 1 },
  ]);
  assert.equal(sorted[0].code, 'open_reconciliations');

  const ctrlSrc = readFileSync(join(__dirname, 'admin.controller.ts'), 'utf8');
  assert.ok(ctrlSrc.includes('peekStoreNotifyMailSnapshot'), 'GET /admin/ops reads process-local mail failures');
  assert.ok(ctrlSrc.includes('storeNotifyMail:'), 'ops snapshot passes storeNotifyMail');

  console.log('admin-ops: store_notify_mail_failed + recon attention sort — PASSOU');
}
