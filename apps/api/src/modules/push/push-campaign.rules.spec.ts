import assert from 'assert';
import {
  audienceTokenWhere,
  canCancelCampaign,
  canDispatchCampaign,
  chunkTokens,
  emptyAudienceSummary,
  FCM_MULTICAST_LIMIT,
  firebaseNotConfiguredSummary,
  FIREBASE_NOT_CONFIGURED_CODE,
  initialCampaignStatus,
  parseSendMode,
  validateCampaignDraft,
} from './push-campaign.rules';

const now = new Date('2026-09-21T15:00:00.000Z');

const good = validateCampaignDraft(
  {
    title: 'Oferta geladeira',
    body: 'Frete grátis hoje',
    linkPath: '/produto/geladeira',
    audience: 'all_enabled',
    sendMode: 'immediate',
  },
  now,
);
assert.equal(good.ok, true);
if (good.ok) {
  assert.equal(good.value.linkPath, '/produto/geladeira');
  assert.ok(good.value.linkUrl?.startsWith('https://lojasschimitz.com.br/'));
  assert.equal(good.value.audience, 'all_enabled');
  assert.equal(good.value.sendMode, 'immediate');
  assert.equal(good.value.scheduledAt, null);
}

const emptyTitle = validateCampaignDraft({ title: '  ', body: 'x', linkPath: '/' }, now);
assert.equal(emptyTitle.ok, false);

const badLink = validateCampaignDraft(
  { title: 'Promo', body: 'Oi', linkPath: 'https://evil.com/x' },
  now,
);
assert.equal(badLink.ok, false);
if (!badLink.ok) assert.equal(badLink.code, 'PUSH_LINK_INVALID');

const badAudience = validateCampaignDraft(
  { title: 'Promo', body: 'Oi', linkPath: '/', audience: 'vip' },
  now,
);
assert.equal(badAudience.ok, false);

const past = validateCampaignDraft(
  {
    title: 'Promo',
    body: 'Oi',
    linkPath: '/',
    sendMode: 'scheduled',
    scheduledAt: '2020-01-01T00:00:00.000Z',
  },
  now,
);
assert.equal(past.ok, false);
if (!past.ok) assert.equal(past.code, 'PUSH_SCHEDULE_PAST');

const future = validateCampaignDraft(
  {
    title: 'Promo',
    body: 'Oi',
    linkPath: '/',
    sendMode: 'agendar',
    scheduledAt: '2026-09-22T12:00:00.000Z',
  },
  now,
);
assert.equal(future.ok, true);
if (future.ok) {
  assert.equal(future.value.sendMode, 'scheduled');
  assert.ok(future.value.scheduledAt instanceof Date);
}

const httpImg = validateCampaignDraft(
  { title: 'Promo', body: 'Oi', linkPath: '/', imageUrl: 'http://x.com/a.png' },
  now,
);
assert.equal(httpImg.ok, false);

assert.equal(parseSendMode('immediate'), 'immediate');
assert.equal(parseSendMode('scheduled'), 'scheduled');
assert.equal(initialCampaignStatus('immediate'), 'sending');
assert.equal(initialCampaignStatus('scheduled'), 'scheduled');
assert.equal(canCancelCampaign('scheduled'), true);
assert.equal(canCancelCampaign('sent'), false);
assert.equal(canDispatchCampaign('scheduled'), true);
assert.equal(canDispatchCampaign('sent'), false);

const allWhere = audienceTokenWhere('all_enabled') as { enabled: boolean; platform: string };
assert.equal(allWhere.enabled, true);
assert.equal(allWhere.platform, 'android');
assert.equal('user' in allWhere, false);

const ordersWhere = audienceTokenWhere('with_orders') as { user: unknown; userId: unknown };
assert.ok(ordersWhere.user);
assert.ok(ordersWhere.userId);

const chunks = chunkTokens(Array.from({ length: 501 }, (_, i) => i));
assert.equal(chunks.length, 2);
assert.equal(chunks[0].length, FCM_MULTICAST_LIMIT);
assert.equal(chunks[1].length, 1);

assert.ok(firebaseNotConfiguredSummary().startsWith(FIREBASE_NOT_CONFIGURED_CODE));
assert.ok(emptyAudienceSummary().includes('Nenhum aparelho'));

console.log('push-campaign.rules tests ok');
