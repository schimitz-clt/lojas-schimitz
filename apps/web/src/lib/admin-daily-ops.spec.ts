import assert from 'assert';
import {
  bulkConfirmMessage,
  bulkProgressLabel,
  bulkSkipReasonLabel,
  catalogPhotoQueueCount,
  emptyPhotoQueueMessage,
  filterCatalogProducts,
  formatBulkAdvanceFeedback,
  fulfillmentNeedsExtraInput,
  isBulkAdvanceEligible,
  isBulkSepararEligible,
  listPhotoUploadSuccessMessage,
  nextOneClickFulfillmentStatus,
  orderedIdsWithNewCover,
  partitionBulkAdvance,
  partitionBulkSeparar,
  photoQueueAlignmentNote,
  productCoverUrl,
  productNeedsStorePhoto,
  pruneSelectedIds,
  selectVisibleEligibleIds,
  shouldPromoteUploadedImageToCover,
  toggleIdInList,
  validateProductPhotoFile,
  collectProductGalleryUrls,
  extraProductImageUrls,
  missingProductImageUrls,
  applyProductSaveImageFields,
} from './admin-daily-ops';

assert.equal(nextOneClickFulfillmentStatus('paid'), 'organizing');
assert.equal(nextOneClickFulfillmentStatus('organizing'), 'packing');
assert.equal(nextOneClickFulfillmentStatus('packing'), 'ready_for_pickup');
assert.equal(nextOneClickFulfillmentStatus('ready_for_pickup'), null, 'in_transit needs tracking');
assert.equal(fulfillmentNeedsExtraInput('ready_for_pickup'), true);
assert.equal(fulfillmentNeedsExtraInput('paid'), false);
assert.equal(nextOneClickFulfillmentStatus('in_transit'), 'delivered');
assert.equal(nextOneClickFulfillmentStatus('delivered'), null);
assert.equal(nextOneClickFulfillmentStatus('awaiting_payment'), null);
assert.equal(nextOneClickFulfillmentStatus('separating'), 'packing');
assert.equal(nextOneClickFulfillmentStatus('shipped'), 'delivered');

assert.equal(isBulkSepararEligible('paid'), true);
assert.equal(isBulkSepararEligible('organizing'), false);
assert.equal(isBulkSepararEligible('packing'), false);
assert.equal(isBulkAdvanceEligible('paid'), true);
assert.equal(isBulkAdvanceEligible('ready_for_pickup'), false);
assert.equal(isBulkAdvanceEligible('cancelled'), false);

const orders = [
  { id: '1', status: 'paid', publicId: 'SCH-1' },
  { id: '2', status: 'organizing', publicId: 'SCH-2' },
  { id: '3', status: 'ready_for_pickup', publicId: 'SCH-3' },
  { id: '4', status: 'delivered', publicId: 'SCH-4' },
  { id: '5', status: 'awaiting_payment', publicId: 'SCH-5' },
];

const sep = partitionBulkSeparar(orders);
assert.deepEqual(
  sep.eligible.map((o) => o.id),
  ['1'],
);
assert.equal(sep.skipped.find((s) => s.item.id === '2')?.reason, 'not_paid_separar');
assert.equal(sep.skipped.find((s) => s.item.id === '3')?.reason, 'needs_tracking');
assert.equal(sep.skipped.find((s) => s.item.id === '4')?.reason, 'no_transition');

const adv = partitionBulkAdvance(orders);
assert.deepEqual(
  adv.eligible.map((o) => o.id),
  ['1', '2'],
);
assert.equal(adv.skipped.find((s) => s.item.id === '3')?.reason, 'needs_tracking');
assert.equal(adv.skipped.find((s) => s.item.id === '4')?.reason, 'no_transition');

assert.ok(bulkSkipReasonLabel('needs_tracking').includes('rastreio'));
assert.ok(bulkSkipReasonLabel('not_paid_separar').includes('Pago'));

const mixedFb = formatBulkAdvanceFeedback(
  {
    ok: [{ publicId: 'SCH-1', from: 'paid', to: 'organizing' }],
    failed: [{ publicId: 'SCH-9', message: 'Pedido alterado por outro processo' }],
    skipped: [{ publicId: 'SCH-3', reason: 'needs_tracking' }],
  },
  'separar',
);
assert.ok(mixedFb.msg.includes('SCH-1 → Organizando'));
assert.ok(mixedFb.msg.includes('SCH-3'));
assert.ok(mixedFb.err.includes('SCH-9'));
assert.ok(mixedFb.err.includes('Falharam'));

const noneFb = formatBulkAdvanceFeedback(
  {
    ok: [],
    failed: [],
    skipped: [{ publicId: 'SCH-3', reason: 'needs_tracking' }],
  },
  'advance',
);
assert.equal(noneFb.msg, '');
assert.ok(noneFb.err.includes('Ignorados'));

assert.equal(formatBulkAdvanceFeedback({ ok: [], failed: [], skipped: [] }, 'advance').err.includes('Nenhum'), true);

assert.ok(bulkConfirmMessage('separar', 3).includes('3 pedido'));
assert.ok(bulkConfirmMessage('advance', 2).includes('rastreio'));
assert.equal(bulkConfirmMessage('separar', 0), '');
assert.equal(bulkProgressLabel(1, 3, 'separar'), 'Separando 1/3…');

assert.deepEqual(toggleIdInList(['a'], 'b'), ['a', 'b']);
assert.deepEqual(toggleIdInList(['a', 'b'], 'a'), ['b']);
assert.deepEqual(pruneSelectedIds(['a', 'b', 'c'], ['b', 'c', 'd']), ['b', 'c']);
assert.deepEqual(
  selectVisibleEligibleIds(orders, 'separar'),
  ['1'],
);
assert.deepEqual(selectVisibleEligibleIds(orders, 'advance').sort(), ['1', '2']);

const products = [
  { id: 'a', images: [] },
  { id: 'b', images: [{ url: 'https://placehold.co/1', position: 0 }] },
  { id: 'c', images: [{ url: 'https://lojasschimitz.com.br/api/v1/uploads/ok.png', position: 0 }] },
  { id: 'd', images: [{ url: '  ', position: 0 }] },
];
assert.equal(productCoverUrl(products[0]), '');
assert.equal(productNeedsStorePhoto(''), true);
assert.equal(productNeedsStorePhoto('https://placehold.co/1'), true);
assert.equal(productNeedsStorePhoto('https://lojasschimitz.com.br/api/v1/uploads/ok.png'), false);
assert.equal(catalogPhotoQueueCount(products), 3);
assert.deepEqual(
  filterCatalogProducts(products, 'needs_photo').map((p) => p.id),
  ['a', 'b', 'd'],
);
assert.equal(filterCatalogProducts(products, 'all').length, 4);

assert.ok(photoQueueAlignmentNote(3, 3).includes('alinhado'));
assert.ok(photoQueueAlignmentNote(5, 3).includes('Lista: 3'));
assert.ok(photoQueueAlignmentNote(5, 3).includes('Ops (snapshot): 5'));
assert.ok(photoQueueAlignmentNote(null, 2).includes('2 produto'));

assert.equal(shouldPromoteUploadedImageToCover(''), true);
assert.equal(shouldPromoteUploadedImageToCover('https://placehold.co/x'), true);
assert.equal(shouldPromoteUploadedImageToCover('https://cdn.example/real.jpg'), false);

assert.deepEqual(orderedIdsWithNewCover(['old', 'mid'], 'new'), ['new', 'old', 'mid']);
assert.deepEqual(orderedIdsWithNewCover(['old', 'new', 'mid'], 'new'), ['new', 'old', 'mid']);
assert.deepEqual(orderedIdsWithNewCover(['only'], 'only'), ['only']);

assert.ok(listPhotoUploadSuccessMessage('TV', true).includes('capa'));
assert.ok(listPhotoUploadSuccessMessage('TV', false).includes('adicionada'));

assert.equal(validateProductPhotoFile(null, 0), 'Selecione um arquivo de imagem.');
assert.ok(validateProductPhotoFile({ type: 'application/pdf', size: 10 }, 0)?.includes('JPG'));
assert.ok(validateProductPhotoFile({ type: 'image/jpeg', size: 16 * 1024 * 1024 }, 0)?.includes('15 MB'));
assert.ok(validateProductPhotoFile({ type: 'image/png', size: 10 }, 10)?.includes('Limite'));
assert.equal(validateProductPhotoFile({ type: 'image/webp', size: 100 }, 2), null);
assert.equal(validateProductPhotoFile({ type: 'image/jpg', size: 100, name: 'a.jpg' }, 0), null);
assert.equal(validateProductPhotoFile({ type: '', size: 100, name: 'capa.JPEG' }, 1), null);
assert.equal(validateProductPhotoFile({ type: 'application/octet-stream', size: 80, name: 'foto.webp' }, 0), null);
assert.ok(validateProductPhotoFile({ type: '', size: 10, name: 'nota.pdf' }, 0)?.includes('JPG'));
assert.ok(validateProductPhotoFile({ type: 'image/heic', size: 80, name: 'IMG.HEIC' }, 0)?.includes('HEIC'));

assert.deepEqual(
  collectProductGalleryUrls(
    [{ url: 'https://cdn.example/a.jpg' }, { url: 'https://cdn.example/b.jpg' }, { url: 'https://cdn.example/a.jpg' }],
    'https://cdn.example/a.jpg',
  ),
  ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
);
assert.deepEqual(extraProductImageUrls(['a', 'b', 'c']), ['b', 'c']);
assert.deepEqual(
  missingProductImageUrls(['https://a', 'https://b'], [{ url: 'https://a' }]),
  ['https://b'],
);

const editEmpty = applyProductSaveImageFields(
  { name: 'Sansung A54', price: 1, imageUrl: '', imageUrls: ['https://stale'] },
  { isEdit: true, galleryUrls: [] },
);
assert.equal('imageUrl' in editEmpty, false, 'edit must omit empty imageUrl (legacy wipe)');
assert.equal('imageUrls' in editEmpty, false, 'edit must not send imageUrls');
assert.equal(editEmpty.name, 'Sansung A54');

const editWithLocalGallery = applyProductSaveImageFields(
  { name: 'X' },
  { isEdit: true, galleryUrls: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'] },
);
assert.equal(
  'imageUrl' in editWithLocalGallery,
  false,
  'edit leaves gallery alone even when form has photos',
);

const createNone = applyProductSaveImageFields({ name: 'Y' }, { isEdit: false, galleryUrls: [] });
assert.equal('imageUrl' in createNone, false, 'create omits imageUrl when there is no cover');

const createMulti = applyProductSaveImageFields(
  { name: 'Y' },
  {
    isEdit: false,
    galleryUrls: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
  },
);
assert.equal(createMulti.imageUrl, 'https://cdn.example/a.jpg');
assert.deepEqual(createMulti.imageUrls, ['https://cdn.example/b.jpg']);

assert.ok(emptyPhotoQueueMessage('needs_photo').includes('Fila sem foto vazia'));
assert.ok(emptyPhotoQueueMessage('all').includes('Nenhum produto'));

console.log('admin-daily-ops web unit ok');
