import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canEditTracking, normalizeTrackingDraft, trackingDraftError, trackingSavedMessage } from './admin-tracking-ui';

assert.equal(canEditTracking('in_transit'), true);
assert.equal(canEditTracking('delivered'), true);
assert.equal(canEditTracking('paid'), false);
assert.equal(normalizeTrackingDraft(' aa 123 br '), 'AA123BR');
assert.equal(trackingDraftError(''), 'Informe o código de rastreio.');
assert.equal(trackingDraftError('ab'), 'Use 4 a 40 letras, números ou hífen.');
assert.equal(trackingDraftError('aa123456789br'), null);
assert.match(trackingSavedMessage('SCH-1', { changed: true, notified: true }), /Cliente avisado/);
assert.match(trackingSavedMessage('SCH-1', { changed: true, notified: false }), /não foi avisado de novo/);
assert.match(trackingSavedMessage('SCH-1', { changed: false, notified: false }), /Nada mudou/);

const state = readFileSync(join(__dirname, '../components/admin/admin-console-state.ts'), 'utf8');
assert.ok(state.includes('/tracking`'), 'usa PATCH /admin/orders/:id/tracking');
const dossier = readFileSync(join(__dirname, '../components/admin/AdminOrderDossier.tsx'), 'utf8');
assert.ok(dossier.includes('canEditTracking(order.status)'));

console.log('admin-tracking-ui.spec ok');
