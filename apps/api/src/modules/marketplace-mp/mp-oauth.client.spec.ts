import assert from 'assert';
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  refreshSellerAccessToken,
} from './mp-oauth.client';

const url = buildAuthorizationUrl({
  clientId: 'app-123',
  redirectUri: 'https://lojasschimitz.com.br/vendedor/mp/callback',
  state: 'state-xyz',
});
assert.ok(url.includes('client_id=app-123'));
assert.ok(url.includes('response_type=code'));
assert.ok(url.includes('state=state-xyz'));
assert.ok(url.includes(encodeURIComponent('https://lojasschimitz.com.br/vendedor/mp/callback')));

async function main() {
  const calls: { url: string; body: string }[] = [];
  const mockFetch: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), body: String(init?.body || '') });
    return new Response(
      JSON.stringify({
        access_token: 'APP_USR-access',
        refresh_token: 'TG-refresh',
        user_id: 4242,
        public_key: 'APP_USR-pub',
        expires_in: 15552000,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const tokens = await exchangeAuthorizationCode(
    {
      clientId: 'cid',
      clientSecret: 'csecret',
      code: 'auth-code-1',
      redirectUri: 'https://lojasschimitz.com.br/vendedor/mp/callback',
    },
    mockFetch,
  );
  assert.equal(tokens.access_token, 'APP_USR-access');
  assert.equal(tokens.refresh_token, 'TG-refresh');
  assert.equal(String(tokens.user_id), '4242');
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes('/oauth/token'));
  assert.ok(calls[0].body.includes('grant_type=authorization_code'));
  assert.ok(calls[0].body.includes('code=auth-code-1'));
  assert.ok(calls[0].body.includes('client_secret=csecret'));

  const refreshed = await refreshSellerAccessToken(
    { clientId: 'cid', clientSecret: 'csecret', refreshToken: 'TG-old' },
    mockFetch,
  );
  assert.equal(refreshed.access_token, 'APP_USR-access');
  assert.ok(calls[1].body.includes('grant_type=refresh_token'));
  assert.ok(calls[1].body.includes('refresh_token=TG-old'));

  const failFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ message: 'invalid_grant' }), { status: 400 });
  let failed = false;
  try {
    await exchangeAuthorizationCode(
      {
        clientId: 'cid',
        clientSecret: 'csecret',
        code: 'bad',
        redirectUri: 'https://example/cb',
      },
      failFetch,
    );
  } catch (e: unknown) {
    failed = true;
    assert.equal((e as { code?: string }).code, 'MP_OAUTH_HTTP_ERROR');
  }
  assert.equal(failed, true);

  console.log('mp-oauth.client.spec ok');
}

void main();
