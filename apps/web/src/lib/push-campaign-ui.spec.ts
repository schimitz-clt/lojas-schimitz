import assert from 'assert';
import {
  abandonedViewAdminNote,
  abandonedViewPreviewLine,
  campaignResultLine,
  canSendPushCampaign,
  emptyPushCampaignForm,
  firebaseProjectLine,
  firebaseStatusHint,
  isNaoExecutado,
  pushAudienceLabel,
  pushDispatchEvidenceLine,
  pushDispatchListSummary,
  pushSendConfirmCopy,
  pushSendResultMessage,
  pushStatusLabel,
  pushStatusTone,
  scheduledAtIso,
  validatePushCampaignForm,
} from './push-campaign-ui';
import { ENTERPRISE_MISSING } from './admin-enterprise-ui';

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

assert.equal(canSendPushCampaign('scheduled'), true);
assert.equal(canSendPushCampaign('sending'), true);
assert.equal(canSendPushCampaign('sent'), false);
assert.equal(canSendPushCampaign('failed'), false);
assert.equal(canSendPushCampaign('cancelled'), false);
assert.equal(canSendPushCampaign(''), false);

const sendCopy = pushSendConfirmCopy({ title: 'Frete grátis', status: 'scheduled' });
assert.ok(sendCopy.title.includes('Frete grátis'));
assert.ok(sendCopy.title.includes('Agendada'));
assert.ok(sendCopy.detail.includes('POST /admin/push/campaigns/:id/send'));
assert.ok(sendCopy.detail.includes('Não cobra'));
assert.ok(sendCopy.detail.includes('não estorna'));
assert.ok(sendCopy.detail.includes('NÃO EXECUTADO'));
assert.equal(pushSendConfirmCopy({ title: '', status: '' }).title.includes(ENTERPRISE_MISSING), true);

assert.ok(pushSendResultMessage(null).includes('não confirmou'));
assert.ok(pushSendResultMessage({ reason: 'nao_executado', dispatched: false }).includes('NÃO EXECUTADO'));
assert.equal(
  pushSendResultMessage({ reason: 'empty_audience', dispatched: true, campaign: { sentCount: 0 } }).includes('0 aparelho'),
  true,
);
assert.ok(
  pushSendResultMessage({ reason: 'empty_audience', dispatched: true, campaign: {} }).includes('não devolveu a contagem'),
);
assert.ok(pushSendResultMessage({ reason: 'already_final', dispatched: false }).includes('não disparou de novo'));
assert.equal(
  pushSendResultMessage({ reason: 'ok', dispatched: true, campaign: { sentCount: 0 } }),
  'Campanha disparada: 0 enviado(s).',
);
assert.ok(pushSendResultMessage({ dispatched: true }).includes('não detalhou'));

assert.equal(pushDispatchListSummary(null), ENTERPRISE_MISSING);
assert.equal(pushDispatchListSummary(0), '0 envio(s) neste detalhe.');
assert.ok(pushDispatchEvidenceLine({ status: 'skipped', tokenFingerprint: '' }).includes(ENTERPRISE_MISSING));
assert.equal(pushDispatchEvidenceLine({ status: 'sent', tokenFingerprint: 'abc', error: '' }).includes('abc'), true);
assert.equal(firebaseProjectLine(''), null);
assert.equal(firebaseProjectLine('loja-1'), 'Projeto loja-1');
assert.equal(pushStatusLabel('skipped'), 'Ignorado');

console.log('push-campaign-ui tests ok');
