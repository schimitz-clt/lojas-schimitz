/**
 * Phase 1 OAuth: code → token with mocked HTTP (no live MP).
 */
import assert from 'assert';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MpOAuthService } from './mp-oauth.service';
import { signMpOAuthState } from './mp-oauth-state';
import { decryptSecret, parseCredentialKey } from './seller-credential-crypto';

const KEY = 'b'.repeat(64);
const saved: Record<string, string | undefined> = {};

function setEnv(k: string, v: string) {
  saved[k] = process.env[k];
  process.env[k] = v;
}
function restoreEnv() {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function mockPrisma() {
  const store: { seller: Record<string, unknown>; cred: Record<string, unknown> | null } = {
    seller: {},
    cred: null,
  };
  const prisma: any = {
    seller: {
      findFirst: async () => null,
      findMany: async () => [] as unknown[],
      update: async ({ data }: { data: Record<string, unknown> }) => {
        store.seller = { ...store.seller, ...data };
        return store.seller;
      },
    },
    sellerMpCredential: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        store.cred = create;
        return create;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        store.cred = { ...(store.cred || {}), ...data };
        return store.cred;
      },
    },
    $transaction: async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
  };
  return { prisma, store };
}

async function main() {
  setEnv('MP_MARKETPLACE_SPLIT_ENABLED', 'true');
  setEnv('MP_MARKETPLACE_CLIENT_ID', 'cid');
  setEnv('MP_MARKETPLACE_CLIENT_SECRET', 'csecret');
  setEnv('MP_SELLER_CREDENTIAL_KEY', KEY);
  setEnv('JWT_ACCESS_SECRET', 'oauth-state-secret-for-tests-xxxx');
  setEnv('MP_MARKETPLACE_REDIRECT_URI', 'https://lojasschimitz.com.br/vendedor/mp/callback');

  const partner = {
    id: 'seller-partner',
    slug: 'parceiro-centro',
    status: 'active',
    mpOAuthStatus: 'pending',
    mpUserId: null,
  };
  const portal = { requireOwnedSeller: async () => partner };
  const { prisma, store } = mockPrisma();
  const svc = new MpOAuthService(prisma as never, portal as never);

  const mockFetch: typeof fetch = async (_url, init) => {
    const body = String((init as RequestInit | undefined)?.body || '');
    assert.ok(body.includes('grant_type=authorization_code'));
    assert.ok(body.includes('code=auth-code-ok'));
    return new Response(
      JSON.stringify({
        access_token: 'APP_USR-live-must-not-leak',
        refresh_token: 'TG-new-refresh',
        user_id: 7788,
        public_key: 'APP_USR-pk',
        expires_in: 3600,
      }),
      { status: 200 },
    );
  };

  const state = signMpOAuthState(partner.id);
  const result = await svc.completeCallback(
    'user-1',
    { code: 'auth-code-ok', state },
    mockFetch,
  );
  assert.equal(result.linked, true);
  assert.equal(result.oauthStatus, 'linked');
  assert.equal(result.mpUserId, '7788');
  assert.equal(store.seller.mpOAuthStatus, 'linked');
  assert.ok(store.cred);
  assert.ok(String(store.cred.accessTokenEnc).startsWith('v1.'));
  assert.ok(!JSON.stringify(store.cred).includes('APP_USR-live-must-not-leak'));
  assert.equal(
    decryptSecret(String(store.cred.accessTokenEnc), parseCredentialKey(KEY)),
    'APP_USR-live-must-not-leak',
  );

  const housePortal = {
    requireOwnedSeller: async () => ({ ...partner, slug: 'lojas-schimitz' }),
  };
  const houseSvc = new MpOAuthService(prisma as never, housePortal as never);
  let houseBlocked = false;
  try {
    await houseSvc.startConnect('user-1');
  } catch (e) {
    houseBlocked = e instanceof BadRequestException;
    const body = (e as BadRequestException).getResponse() as { code: string };
    assert.equal(body.code, 'HOUSE_BRAND_NO_SELF_SPLIT');
  }
  assert.equal(houseBlocked, true);

  process.env.MP_MARKETPLACE_SPLIT_ENABLED = 'false';
  let flagOff = false;
  try {
    await svc.startConnect('user-1');
  } catch (e) {
    flagOff = e instanceof NotFoundException;
    const body = (e as NotFoundException).getResponse() as { code: string };
    assert.equal(body.code, 'MP_CONNECT_DISABLED');
  }
  assert.equal(flagOff, true);

  // refreshDue no-ops when flag off
  const skipped = await svc.refreshDue({ fetchImpl: mockFetch });
  assert.equal(skipped.skipped, true);
  assert.equal(skipped.reason, 'flag_off');

  restoreEnv();
  console.log('mp-oauth.flow.spec ok');
}

void main().catch((e) => {
  restoreEnv();
  console.error(e);
  process.exit(1);
});
