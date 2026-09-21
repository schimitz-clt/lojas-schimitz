import assert from 'assert';
import {
  abandonedViewAdminNote,
  abandonedViewPreviewLine,
  campaignResultLine,
  emptyPushCampaignForm,
  firebaseStatusHint,
  isNaoExecutado,
  pushAudienceLabel,
  pushStatusLabel,
  pushStatusTone,
  scheduledAtIso,
  validatePushCampaignForm,
} from './push-campaign-ui';

assert.equal(pushAudienceLabel('all_enabled'), 'Todos os aparelhos com push ativo');
assert.ok(pushAudienceLabel('with_orders').includes('pedidos'));
assert.equal(pushStatusLabel('sent'), 'Enviada');
assert.equal(pushStatusLabel('scheduled'), 'Agendada');
assert.equal(pushStatusTone('sent'), 'ok');
assert.equal(pushStatusTone('failed'), 'danger');
assert.equal(isNaoExecutado('NÃO EXECUTADO: Firebase Admin não configurado'), true);
assert.equal(isNaoExecutado('ok'), false);
assert.ok(abandonedViewAdminNote().includes('automática'));
assert.ok(abandonedViewPreviewLine({ openViews: 0, dueViews: 0, sentLast7Days: 0 }).includes('0 visita'));

const line = campaignResultLine({
  sentCount: 0,
  failedCount: 0,
  skippedCount: 3,
  errorSummary: 'NÃO EXECUTADO: x',
});
assert.ok(line.includes('NÃO EXECUTADO'));
assert.ok(line.includes('3 ignorado'));

const empty = emptyPushCampaignForm();
assert.equal(validatePushCampaignForm(empty), 'Informe o título');
assert.equal(
  validatePushCampaignForm({ ...empty, title: 'Promo', body: 'Oi', linkPath: 'https://evil.com' }),
  'Link deve ser da loja (lojasschimitz.com.br)',
);
assert.equal(
  validatePushCampaignForm({ ...empty, title: 'Promo', body: 'Oi', linkPath: '/' }),
  null,
);
assert.equal(
  validatePushCampaignForm({
    ...empty,
    title: 'Promo',
    body: 'Oi',
    sendMode: 'scheduled',
    scheduledAt: '',
  }),
  'Informe data e hora para agendar',
);

const iso = scheduledAtIso({
  ...empty,
  sendMode: 'scheduled',
  scheduledAt: '2026-09-22T12:00',
});
assert.ok(iso && iso.includes('2026-09-22'));
assert.equal(scheduledAtIso({ ...empty, sendMode: 'immediate', scheduledAt: '2026-09-22T12:00' }), undefined);

const off = firebaseStatusHint({ firebaseConfigured: false });
assert.equal(off.tone, 'warn');
assert.ok(off.text.includes('NÃO EXECUTADO'));
const on = firebaseStatusHint({ firebaseConfigured: true });
assert.equal(on.tone, 'ok');

console.log('push-campaign-ui tests ok');
