import assert from 'assert';
import {
  fcmDataPayload,
  isAllowedStorefrontHost,
  mapPushDeepLink,
  normalizePushLinkPath,
  STOREFRONT_ORIGIN,
} from './push-deeplink';

assert.equal(normalizePushLinkPath(''), '/');
assert.equal(normalizePushLinkPath('  /produto/x  '), '/produto/x');
assert.equal(isAllowedStorefrontHost('lojasschimitz.com.br'), true);
assert.equal(isAllowedStorefrontHost('www.lojasschimitz.com.br'), true);
assert.equal(isAllowedStorefrontHost('evil.example'), false);

const home = mapPushDeepLink('');
assert.equal(home.ok, true);
assert.equal(home.path, '/');
assert.equal(home.url, `${STOREFRONT_ORIGIN}/`);

const rel = mapPushDeepLink('/produto/geladeira-x');
assert.equal(rel.ok, true);
assert.equal(rel.path, '/produto/geladeira-x');
assert.equal(rel.url, `${STOREFRONT_ORIGIN}/produto/geladeira-x`);

const noSlash = mapPushDeepLink('c/eletro');
assert.equal(noSlash.ok, true);
assert.equal(noSlash.path, '/c/eletro');

const abs = mapPushDeepLink('https://lojasschimitz.com.br/produto/foo?utm=1');
assert.equal(abs.ok, true);
assert.equal(abs.path, '/produto/foo?utm=1');
assert.equal(abs.url, `${STOREFRONT_ORIGIN}/produto/foo?utm=1`);

const www = mapPushDeepLink('https://www.lojasschimitz.com.br/conta');
assert.equal(www.ok, true);
assert.equal(www.url, `${STOREFRONT_ORIGIN}/conta`);

assert.equal(mapPushDeepLink('javascript:alert(1)').ok, false);
assert.equal(mapPushDeepLink('file:///sdcard/x').ok, false);
assert.equal(mapPushDeepLink('intent://scan/#Intent').ok, false);
assert.equal(mapPushDeepLink('data:text/html,hi').ok, false);
assert.equal(mapPushDeepLink('http://lojasschimitz.com.br/').ok, false);
assert.equal(mapPushDeepLink('https://mercadopago.com.br/checkout').ok, false);
assert.equal(mapPushDeepLink('//lojasschimitz.com.br/x').ok, false);
assert.equal(mapPushDeepLink('https://evil.com/?u=https://lojasschimitz.com.br').ok, false);

const payload = fcmDataPayload({ path: '/produto/x', url: `${STOREFRONT_ORIGIN}/produto/x`, campaignId: 'c1' });
assert.equal(payload.path, '/produto/x');
assert.equal(payload.link, `${STOREFRONT_ORIGIN}/produto/x`);
assert.equal(payload.campaignId, 'c1');
assert.equal(typeof payload.link, 'string');

console.log('push-deeplink tests ok');
