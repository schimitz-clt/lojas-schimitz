import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CATALOG_BATCH_PHOTO_NOTE,
  ENTERPRISE_MISSING,
  ORDER_ACTOR_SCOPE,
  catalogActiveBatchBody,
  catalogBatchConfirmText,
  catalogBatchFeedback,
  catalogBatchProgressLabel,
  catalogBatchRequestError,
  catalogBatchSkipNote,
  catalogStockBatchBody,
  countOrDash,
  formatOrderAddress,
  fulfillmentConfirmCopy,
  historyActorLabel,
  moneyOrDash,
  orderDossierModel,
  orderMutationErrorText,
  partitionCatalogBatch,
  salesEvidenceModel,
} from './admin-enterprise-ui';

assert.equal(moneyOrDash(null), ENTERPRISE_MISSING);
assert.equal(moneyOrDash(''), ENTERPRISE_MISSING);
assert.equal(moneyOrDash('nope'), ENTERPRISE_MISSING);
assert.ok(moneyOrDash(0).includes('0'), 'zero stays zero');
assert.ok(moneyOrDash('19.90').includes('19'));
assert.ok(moneyOrDash('1.234,50').includes('1'));

assert.equal(countOrDash(0), '0');
assert.equal(countOrDash(null), ENTERPRISE_MISSING);
assert.equal(countOrDash(''), ENTERPRISE_MISSING);

assert.equal(formatOrderAddress(null), ENTERPRISE_MISSING);
assert.equal(formatOrderAddress({}), ENTERPRISE_MISSING);
assert.equal(
  formatOrderAddress({
    label: 'Casa',
    street: 'Rua das Flores',
    number: '100',
    district: 'Centro',
    city: 'Blumenau',
    uf: 'SC',
    cep: '89010000',
  }),
  'Casa · Rua das Flores, 100 · Centro · Blumenau/SC · CEP 89010000',
);
assert.equal(formatOrderAddress({ city: 'Blumenau', uf: 'SC' }), 'Blumenau/SC');

const full = orderDossierModel({
  publicId: 'SCH-3042',
  status: 'paid',
  subtotal: 100,
  discount: 0,
  cashbackUsed: 0,
  freight: 0,
  total: 100,
  createdAt: '2026-09-22T12:00:00.000Z',
  updatedAt: '2026-09-22T13:00:00.000Z',
  user: { name: 'Ana', email: 'ana@loja.test', phone: '47999990000' },
  addressSnap: { street: 'Rua A', number: '1', city: 'Blumenau', uf: 'SC' },
  freightSnap: { label: 'Entrega própria', days: 2, carrier: 'propria' },
  items: [{ name: 'Fone', qty: 2, unitPrice: '50.00', imageUrl: 'https://cdn.example/fone.jpg' }],
  payments: [
    {
      status: 'approved',
      method: 'pix',
      provider: 'mercadopago',
      amount: 100,
      externalId: 'mp-1',
      createdAt: '2026-09-22T12:05:00.000Z',
    },
  ],
  statusHistory: [
    {
      fromStatus: 'awaiting_payment',
      toStatus: 'paid',
      createdAt: '2026-09-22T12:05:00.000Z',
      actorId: 'admin-9',
      note: 'pagamento',
    },
  ],
});

assert.equal(full.publicId, 'SCH-3042');
assert.ok(full.statusLabel.includes('Pago'));
assert.ok(full.statusLabel.includes('paid'));
assert.equal(full.nextStatus, 'organizing');
assert.equal(full.needsTracking, false);
assert.ok(full.totals.find((row) => row.label === 'Desconto')?.value.includes('0'));
assert.ok(full.totals.find((row) => row.label === 'Frete')?.value.includes('0'));
assert.equal(full.customerName, 'Ana');
assert.ok(full.address.includes('Rua A, 1'));
assert.equal(full.freightDays, '2');
assert.equal(full.items[0]?.qty, '2');
assert.equal(full.items[0]?.imageUrl, 'https://cdn.example/fone.jpg');
assert.ok(full.items[0]?.line.includes('100'));
assert.ok(full.payments[0]?.includes('PIX'));
const cardPay = orderDossierModel({
  payments: [{ status: 'approved', method: 'credit_card', amount: 10 }],
});
assert.ok(cardPay.payments[0]?.includes('Cartão'));
assert.ok(full.payments[0]?.includes('ext mp-1'));
assert.equal(full.history[0]?.actor, 'admin-9');
assert.equal(full.history[0]?.from, 'Aguardando pagamento');
assert.ok(full.createdAt !== ENTERPRISE_MISSING);

const sparse = orderDossierModel({ status: 'delivered' });
assert.equal(sparse.publicId, ENTERPRISE_MISSING);
assert.equal(sparse.nextStatus, null);
assert.equal(sparse.nextLabel, ENTERPRISE_MISSING);
assert.equal(sparse.customerEmail, ENTERPRISE_MISSING);
assert.equal(sparse.address, ENTERPRISE_MISSING);
assert.equal(sparse.tracking, ENTERPRISE_MISSING);
assert.equal(sparse.totals.find((row) => row.label === 'Total')?.value, ENTERPRISE_MISSING);
assert.deepEqual(sparse.items, []);
assert.deepEqual(sparse.payments, []);
assert.deepEqual(sparse.history, []);
assert.equal(sparse.updatedAt, ENTERPRISE_MISSING);

const zeroItem = orderDossierModel({
  items: [{ name: 'Cabo', qty: 0, unitPrice: 10 }],
});
assert.equal(zeroItem.items[0]?.qty, '0');
assert.ok(zeroItem.items[0]?.line.includes('0'));

assert.equal(historyActorLabel(null), ENTERPRISE_MISSING);
assert.equal(historyActorLabel('  '), ENTERPRISE_MISSING);
assert.equal(historyActorLabel('user-1'), 'user-1');
assert.ok(ORDER_ACTOR_SCOPE.includes('actorId'));
assert.ok(ORDER_ACTOR_SCOPE.includes('não vem neste payload'));

const confirm = fulfillmentConfirmCopy({
  publicId: 'SCH-1',
  fromStatus: 'paid',
  toStatus: 'organizing',
});
assert.ok(confirm.title.includes('SCH-1'));
assert.ok(confirm.title.includes('Pago'));
assert.ok(confirm.title.includes('Organizando'));
assert.ok(confirm.detail.includes('PATCH /admin/orders/:id/status'));
assert.ok(confirm.detail.includes('Sem cobrança'));
assert.equal(confirm.detail.includes('refund'), false);

const transit = fulfillmentConfirmCopy({
  publicId: 'SCH-2',
  fromStatus: 'ready_for_pickup',
  toStatus: 'in_transit',
});
assert.ok(transit.detail.includes('Rastreio é opcional'));

assert.equal(orderMutationErrorText(''), 'A API não confirmou a atualização de status.');
assert.equal(orderMutationErrorText('  '), 'A API não confirmou a atualização de status.');
assert.equal(
  orderMutationErrorText('Transição inválida: delivered → organizing'),
  'Transição inválida: delivered → organizing',
);

const part = partitionCatalogBatch(
  [
    { id: '1', sku: 'FICT-001', name: 'Fone' },
    { id: '2', sku: ' ', name: 'Sem código' },
    { id: '3', sku: 'FICT-001', name: 'Duplicado' },
    { id: '4', sku: 'AB', name: 'Curto ok' },
    { id: '5', sku: 'X', name: 'Curto demais' },
  ],
  ['1', '2', '3', '5', '9'],
);
assert.deepEqual(part.skus, ['FICT-001']);
assert.equal(part.missingSku.length, 2);
assert.equal(catalogBatchRequestError({ skus: [], missingSku: part.missingSku })?.includes('Nada foi enviado'), true);
assert.equal(catalogBatchRequestError({ skus: ['FICT-001'], missingSku: [] }), null);
assert.ok(catalogBatchSkipNote(part.missingSku).includes('Sem SKU'));
assert.equal(catalogBatchSkipNote([]), '');

const stockSet = catalogStockBatchBody(['FICT-001'], 'set', '0');
assert.equal(stockSet.ok, true);
if (stockSet.ok) {
  assert.equal(stockSet.body.stockValue, 0);
  assert.equal(stockSet.body.stockMode, 'set');
  assert.equal('delete' in stockSet.body, false);
}
assert.equal(catalogStockBatchBody(['FICT-001'], 'set', '-1').ok, false);
assert.equal(catalogStockBatchBody(['FICT-001'], 'delta', '0').ok, false);
assert.equal(catalogStockBatchBody(['FICT-001'], 'delta', '2').ok, true);
assert.equal(catalogStockBatchBody(['FICT-001'], 'set', '1,5').ok, false);

const activeBody = catalogActiveBatchBody(['FICT-001'], false);
assert.deepEqual(activeBody, { skus: ['FICT-001'], active: false });
assert.ok(catalogBatchConfirmText('stock-set', 2, '4').includes('POST /admin/products/batch'));
assert.ok(catalogBatchConfirmText('deactivate', 1).includes('Nada é apagado'));
assert.equal(catalogBatchProgressLabel(3), 'Aplicando lote em 3 SKU(s)…');
assert.ok(CATALOG_BATCH_PHOTO_NOTE.includes('Foto não entra neste lote'));
assert.ok(CATALOG_BATCH_PHOTO_NOTE.includes('POST /admin/products/batch'));

const feedback = catalogBatchFeedback({
  updated: 1,
  failed: 1,
  deleted: 0,
  errors: [{ sku: 'FICT-404', message: 'SKU não encontrado. Nada foi criado.' }],
});
assert.ok(feedback.summary.includes('Atualizados: 1'));
assert.ok(feedback.summary.includes('Falhas: 1'));
assert.ok(feedback.summary.includes('Apagados: 0'));
assert.equal(feedback.lines[0], 'FICT-404: SKU não encontrado. Nada foi criado.');

const blankReport = catalogBatchFeedback({});
assert.ok(blankReport.summary.includes(`Atualizados: ${ENTERPRISE_MISSING}`));
assert.deepEqual(blankReport.lines, []);

const truncated = catalogBatchFeedback({
  updated: 0,
  failed: 2,
  deleted: 0,
  errors: [{ sku: '', message: '' }],
  errorsTruncated: true,
});
assert.ok(truncated.summary.includes('Atualizados: 0'));
assert.equal(truncated.lines[0], 'SKU —: A API não detalhou o erro.');
assert.ok(truncated.lines[1]?.includes('truncou'));

const salesFull = salesEvidenceModel({
  from: '2026-09-01',
  to: '2026-09-22',
  timezone: 'America/Sao_Paulo',
  summary: { orderCount: 3, revenue: 150.5, averageTicket: 50.17 },
  byStatus: { delivered: 1, paid: 2, awaiting_payment: 0 },
  byDay: [{ date: '2026-09-22', orderCount: 1, revenue: 0 }],
  topProducts: [{ productId: 'p1', name: 'Fone', qty: 2, revenue: 100 }],
  bySeller: [
    { sellerId: null, sellerName: 'Loja própria', orderCount: 2, itemQty: 3, revenue: 100 },
    { sellerId: 's1', sellerName: 'Parceiro', orderCount: 1, itemQty: 1, revenue: 50.5 },
  ],
  byPaymentMethod: [
    { method: 'pix', orderCount: 2, revenue: 100 },
    { method: 'credit_card', orderCount: 1, revenue: 50.5 },
  ],
});
assert.deepEqual(Object.keys(salesFull).sort(), [
  'averageTicket',
  'byDay',
  'byDayMissing',
  'byPaymentMethod',
  'byPaymentMissing',
  'bySeller',
  'bySellerMissing',
  'byStatus',
  'byStatusMissing',
  'orderCount',
  'periodFrom',
  'periodTo',
  'revenue',
  'timezone',
  'topProducts',
  'topProductsMissing',
].sort());
assert.equal(salesFull.orderCount, '3');
assert.ok(salesFull.revenue.includes('150'));
assert.ok(salesFull.averageTicket.includes('50'));
assert.equal(salesFull.byStatus.map((row) => row.status).join(','), 'paid,delivered,awaiting_payment');
assert.equal(salesFull.byStatus.find((row) => row.status === 'paid')?.bucket, 'paid');
assert.equal(salesFull.byStatus.find((row) => row.status === 'awaiting_payment')?.count, '0');
assert.equal(salesFull.byStatus.find((row) => row.status === 'awaiting_payment')?.bucket, 'awaiting_payment');
assert.equal(salesFull.byDay[0]?.revenue.includes('0'), true);
assert.equal(salesFull.byDay[0]?.orderCount, '1');
assert.equal(salesFull.bySeller[0]?.ownStore, true);
assert.equal(salesFull.bySeller[1]?.ownStore, false);
assert.equal(salesFull.bySeller[1]?.sellerId, 's1');
assert.equal(salesFull.byPaymentMethod[0]?.label, 'PIX');
assert.equal(salesFull.byPaymentMethod[1]?.label, 'Cartão');
assert.equal(salesFull.topProducts[0]?.name, 'Fone');
assert.equal(salesFull.topProducts[0]?.qty, '2');
assert.equal('customer' in salesFull, false);
assert.equal('margin' in salesFull, false);

const salesZero = salesEvidenceModel({
  summary: { orderCount: 0, revenue: 0, averageTicket: 0 },
  byStatus: { paid: 0 },
  byDay: [],
  bySeller: [],
  topProducts: [],
  byPaymentMethod: [],
});
assert.equal(salesZero.orderCount, '0');
assert.ok(salesZero.revenue.includes('0'));
assert.ok(salesZero.averageTicket.includes('0'));
assert.equal(salesZero.byStatus[0]?.count, '0');
assert.equal(salesZero.byDayMissing, false);
assert.deepEqual(salesZero.byDay, []);
assert.equal(salesZero.topProductsMissing, false);
assert.equal(salesZero.byPaymentMissing, false);

const salesSparse = salesEvidenceModel({});
assert.equal(salesSparse.periodFrom, ENTERPRISE_MISSING);
assert.equal(salesSparse.periodTo, ENTERPRISE_MISSING);
assert.equal(salesSparse.timezone, ENTERPRISE_MISSING);
assert.equal(salesSparse.orderCount, ENTERPRISE_MISSING);
assert.equal(salesSparse.revenue, ENTERPRISE_MISSING);
assert.equal(salesSparse.averageTicket, ENTERPRISE_MISSING);
assert.equal(salesSparse.byStatusMissing, true);
assert.equal(salesSparse.byDayMissing, true);
assert.equal(salesSparse.bySellerMissing, true);
assert.equal(salesSparse.topProductsMissing, true);
assert.equal(salesSparse.byPaymentMissing, true);
assert.deepEqual(salesSparse.byStatus, []);
assert.deepEqual(salesSparse.topProducts, []);

const salesNoTicket = salesEvidenceModel({
  summary: { orderCount: 2, revenue: 100 },
});
assert.equal(salesNoTicket.orderCount, '2');
assert.ok(salesNoTicket.revenue.includes('100'));
assert.equal(salesNoTicket.averageTicket, ENTERPRISE_MISSING);

const salesBlankMethod = salesEvidenceModel({
  byStatus: { cancelled: 1, separating: 2 },
  byPaymentMethod: [
    { method: '', orderCount: 0, revenue: 0 },
    { method: 'crypto', orderCount: 1, revenue: 10 },
  ],
  bySeller: [{ sellerName: 'Sem id', orderCount: 1, itemQty: 1, revenue: 1 }],
  topProducts: [{ name: '', qty: 0, revenue: 0 }],
});
assert.equal(salesBlankMethod.byStatus.find((row) => row.status === 'cancelled')?.bucket, null);
assert.equal(salesBlankMethod.byStatus.find((row) => row.status === 'separating')?.bucket, null);
assert.equal(salesBlankMethod.byPaymentMethod[0]?.label, ENTERPRISE_MISSING);
assert.equal(salesBlankMethod.byPaymentMethod[0]?.orderCount, '0');
assert.equal(salesBlankMethod.byPaymentMethod[0]?.label === 'Outro', false);
assert.equal(salesBlankMethod.byPaymentMethod[1]?.label, 'crypto');
assert.equal(salesBlankMethod.bySeller[0]?.ownStore, false);
assert.equal(salesBlankMethod.bySeller[0]?.sellerId, ENTERPRISE_MISSING);
assert.equal(salesBlankMethod.topProducts[0]?.name, ENTERPRISE_MISSING);
assert.equal(salesBlankMethod.topProducts[0]?.qty, '0');
assert.ok(salesBlankMethod.topProducts[0]?.revenue.includes('0'));

const salesNull = salesEvidenceModel(null);
assert.equal(salesNull.revenue, ENTERPRISE_MISSING);
assert.equal(salesNull.byDayMissing, true);

const srcRoot = join(__dirname, '..');
const pedidos = readFileSync(join(srcRoot, 'components/admin/sections/AdminPedidosSection.tsx'), 'utf8');
const catalog = readFileSync(join(srcRoot, 'components/admin/sections/AdminCatalogoSection.tsx'), 'utf8');
const vendas = readFileSync(join(srcRoot, 'components/admin/sections/AdminVendasSection.tsx'), 'utf8');
const dossier = readFileSync(join(srcRoot, 'components/admin/AdminOrderDossier.tsx'), 'utf8');
const state = readFileSync(join(srcRoot, 'components/admin/admin-console-state.ts'), 'utf8');

assert.ok(pedidos.includes('AdminOrderDossier'), 'order evidence opens in the dossier');
assert.ok(pedidos.includes('id="admin-orders-queue"'), 'queue anchor stays');
assert.ok(pedidos.includes('pedidosCommandCounts'), 'snapshot counts stay on the helper');
assert.ok(pedidos.includes('askAdvance'), 'single advance asks before PATCH');
assert.ok(dossier.includes('ORDER_ACTOR_SCOPE'));
assert.ok(dossier.includes('fulfillmentConfirmCopy'));
assert.ok(dossier.includes('paymentRefundConfirmCopy'), 'refund asks in the dossier before POST');
assert.ok(dossier.includes('onCancelRefund'), 'Voltar does not post the refund');
assert.equal(dossier.includes('charge'), false);

assert.ok(catalog.includes("'/admin/products/batch'"), 'list batch uses the existing endpoint');
assert.ok(catalog.includes('CATALOG_BATCH_PHOTO_NOTE'));
assert.ok(catalog.includes('id="admin-product-form"'));
assert.ok(catalog.includes('AdminCatalogImportPanel'));
assert.equal(catalog.includes('/refund'), false);

assert.ok(state.includes('orderMutationErrorText'), 'status failure keeps the API message');
assert.ok(state.includes('/admin/orders/${order.id}/status'), 'status PATCH stays');
assert.equal(state.includes('window.prompt'), false, 'tracking is collected in the dossier, not a prompt');

assert.ok(vendas.includes('vendasCommandCounts'), 'snapshot windows stay on the helper');
assert.ok(vendas.includes('salesEvidenceModel'), 'period evidence stays on the helper');
assert.ok(vendas.includes('exportSalesCsv'), 'CSV stays the existing download');
assert.ok(vendas.includes('GET /admin/ops'));
assert.ok(vendas.includes('VENDAS_EVIDENCE_LEDE'));
assert.ok(vendas.includes('VENDAS_READONLY_NOTE'));
assert.ok(vendas.includes('blocks={{'), 'omitted chart blocks stay explicit');
assert.ok(vendas.includes("buildAdminSectionHref('clientes')"));
assert.ok(vendas.includes('selectOpsBucket'));
assert.equal(vendas.includes('/refund'), false);
assert.equal(vendas.includes('mercadopago'), false);
assert.equal(vendas.includes('/admin/reports/sales/export'), false);
assert.equal(pedidos.includes('vendasCommandCounts'), false);
assert.equal(catalog.includes('vendasCommandCounts'), false);

console.log('admin-enterprise-ui spec ok');
