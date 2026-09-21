import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  abandonedViewAdminNote,
  abandonedViewPreviewLine,
} from './push-campaign-ui';
import {
  buildProductViewBody,
  readPushDeviceIdFromBridge,
  readPushDeviceIdFromCookie,
  resolvePushDeviceId,
} from './abandoned-product-view';

const DEVICE = '11111111-1111-4111-8111-111111111111';

assert.equal(readPushDeviceIdFromCookie(`sch_access=jwt; sch_push_device=${DEVICE}`), DEVICE);
assert.equal(readPushDeviceIdFromCookie('sch_access=jwt'), null);
assert.equal(readPushDeviceIdFromCookie('sch_push_device=not-a-uuid'), null);
assert.equal(
  readPushDeviceIdFromBridge({ pushDeviceId: () => DEVICE }),
  DEVICE,
);
assert.equal(readPushDeviceIdFromBridge({}), null);
assert.equal(readPushDeviceIdFromBridge({ pushDeviceId: () => 'fcm-token' }), null);
assert.equal(
  resolvePushDeviceId({ cookieHeader: '', bridge: { pushDeviceId: () => DEVICE } }),
  DEVICE,
);
assert.equal(resolvePushDeviceId({ cookieHeader: 'foo=bar', bridge: null }), null);

const body = buildProductViewBody({
  productId: '22222222-2222-4222-8222-222222222222',
  slug: 'sansung-a54',
  deviceId: DEVICE,
});
assert.deepEqual(body, {
  productId: '22222222-2222-4222-8222-222222222222',
  slug: 'sansung-a54',
  deviceId: DEVICE,
});
assert.equal(
  buildProductViewBody({ productId: 'p', slug: 's', deviceId: null }),
  null,
);

const note = abandonedViewAdminNote();
assert.ok(note.includes('Recuperação de produto é automática'));
assert.ok(note.includes('não dispara'));
assert.equal(
  abandonedViewPreviewLine({ openViews: 2, dueViews: 1, sentLast7Days: 4 }),
  '2 visita(s) em aberto · 1 com atraso cumprido · 4 enviado(s) em 7 dias',
);

const pdp = readFileSync(join(__dirname, '../app/produto/[slug]/ProductClient.tsx'), 'utf8');
assert.ok(pdp.includes('recordAbandonedProductView'), 'PDP records the view');
const admin = readFileSync(
  join(__dirname, '../components/admin/sections/AdminNotificacoesSection.tsx'),
  'utf8',
);
assert.ok(admin.includes('abandonedViewAdminNote'), 'admin explains automatic recovery');
assert.ok(admin.includes('/admin/push/abandoned-views'), 'admin reads the dry-run counts');

console.log('abandoned-product-view.spec ok');
