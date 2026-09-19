/**
 * Mercado Pago OAuth HTTP helpers. fetchImpl is injectable for unit tests.
 * OAuth HTTP only. Payment charges use seller tokens from SellerMpCredential
 * on the Phase 2 sandbox path — not this client.
 */

export type MpTokenResponse = {
  access_token: string;
  refresh_token: string;
  user_id: number | string;
  public_key?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

export type FetchLike = typeof fetch;

const DEFAULT_TOKEN_URL = 'https://api.mercadopago.com/oauth/token';
const DEFAULT_AUTH_BASE = 'https://auth.mercadopago.com.br/authorization';

export function marketplaceAuthBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.MP_MARKETPLACE_AUTH_URL || DEFAULT_AUTH_BASE).trim() || DEFAULT_AUTH_BASE;
}

export function marketplaceTokenUrl(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.MP_MARKETPLACE_TOKEN_URL || DEFAULT_TOKEN_URL).trim() || DEFAULT_TOKEN_URL;
}

export function buildAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const base = marketplaceAuthBaseUrl(input.env);
  const url = new URL(base);
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('platform_id', 'mp');
  url.searchParams.set('state', input.state);
  url.searchParams.set('redirect_uri', input.redirectUri);
  return url.toString();
}

async function postToken(
  body: URLSearchParams,
  fetchImpl: FetchLike,
  env: NodeJS.ProcessEnv = process.env,
): Promise<MpTokenResponse> {
  const res = await fetchImpl(marketplaceTokenUrl(env), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err: Error & { status?: number; code?: string } = new Error(
      String(json.message || json.error_description || `Mercado Pago OAuth HTTP ${res.status}`),
    );
    err.status = res.status;
    err.code = 'MP_OAUTH_HTTP_ERROR';
    throw err;
  }
  const access = String(json.access_token || '');
  const refresh = String(json.refresh_token || '');
  const userId = json.user_id;
  if (!access || !refresh || userId == null || userId === '') {
    const err: Error & { code?: string } = new Error('Resposta OAuth do Mercado Pago incompleta');
    err.code = 'MP_OAUTH_RESPONSE_INVALID';
    throw err;
  }
  return {
    access_token: access,
    refresh_token: refresh,
    user_id: userId as number | string,
    public_key: json.public_key ? String(json.public_key) : undefined,
    expires_in: typeof json.expires_in === 'number' ? json.expires_in : undefined,
    token_type: json.token_type ? String(json.token_type) : undefined,
    scope: json.scope ? String(json.scope) : undefined,
  };
}

export async function exchangeAuthorizationCode(
  input: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
    env?: NodeJS.ProcessEnv;
  },
  fetchImpl: FetchLike = fetch,
): Promise<MpTokenResponse> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
  });
  return postToken(body, fetchImpl, input.env);
}

export async function refreshSellerAccessToken(
  input: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    env?: NodeJS.ProcessEnv;
  },
  fetchImpl: FetchLike = fetch,
): Promise<MpTokenResponse> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
  });
  return postToken(body, fetchImpl, input.env);
}
