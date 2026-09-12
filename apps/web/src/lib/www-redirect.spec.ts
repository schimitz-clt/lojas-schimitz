import assert from 'assert';
import { normalizeHost, wwwApexRedirectUrl, WWW_HOST, APEX_ORIGIN } from './www-redirect';

assert.equal(normalizeHost('www.lojasschimitz.com.br'), WWW_HOST);
assert.equal(normalizeHost('WWW.LojasSchimitz.com.br:443'), WWW_HOST);
assert.equal(normalizeHost('www.lojasschimitz.com.br.'), WWW_HOST);
assert.equal(normalizeHost('lojasschimitz.com.br'), 'lojasschimitz.com.br');
assert.equal(normalizeHost(null), '');

assert.equal(wwwApexRedirectUrl({ host: 'lojasschimitz.com.br', pathname: '/' }), null);
assert.equal(wwwApexRedirectUrl({ host: 'localhost', pathname: '/produtos' }), null);
assert.equal(
  wwwApexRedirectUrl({ host: 'www.lojasschimitz.com.br', pathname: '/' }),
  `${APEX_ORIGIN}/`,
);
assert.equal(
  wwwApexRedirectUrl({
    host: 'WWW.lojasschimitz.com.br:443',
    pathname: '/produto/roblox',
    search: '?ref=ad',
  }),
  `${APEX_ORIGIN}/produto/roblox?ref=ad`,
);
assert.equal(
  wwwApexRedirectUrl({
    host: 'www.lojasschimitz.com.br',
    pathname: '/api/v1/health',
    search: '',
  }),
  `${APEX_ORIGIN}/api/v1/health`,
);
assert.equal(
  wwwApexRedirectUrl({ host: 'www.lojasschimitz.com.br' }),
  `${APEX_ORIGIN}/`,
);

console.log('www-redirect unit tests ok');
