import assert from 'assert';
import { resolveSiteUrl } from './auth.service';

function env( partial: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...partial } as NodeJS.ProcessEnv;
}

// Happy path — prefers NEXT_PUBLIC_SITE_URL
assert.equal(
  resolveSiteUrl(
    env({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: 'https://lojasschimitz.com.br/',
      PUBLIC_WEB_URL: 'https://other.example',
      CORS_ORIGINS: 'http://localhost:3000,https://lojasschimitz.com.br',
    }),
  ),
  'https://lojasschimitz.com.br',
);

// Falls back to PUBLIC_WEB_URL
assert.equal(
  resolveSiteUrl(
    env({
      NODE_ENV: 'production',
      PUBLIC_WEB_URL: 'https://lojasschimitz.com.br',
      CORS_ORIGINS: 'http://localhost:3000',
    }),
  ),
  'https://lojasschimitz.com.br',
);

// Skips localhost CORS in production → production fallback
assert.equal(
  resolveSiteUrl(
    env({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000',
    }),
  ),
  'https://lojasschimitz.com.br',
);

// Rejects string "null" / "undefined" / empty in production
assert.equal(
  resolveSiteUrl(
    env({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: 'null',
      PUBLIC_WEB_URL: 'undefined',
      CORS_ORIGINS: '',
    }),
  ),
  'https://lojasschimitz.com.br',
);

// Skips bad NEXT_PUBLIC then uses good CORS entry in production
assert.equal(
  resolveSiteUrl(
    env({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      CORS_ORIGINS: 'http://localhost:3000,https://lojasschimitz.com.br',
    }),
  ),
  'https://lojasschimitz.com.br',
);

// Dev may use localhost
assert.equal(
  resolveSiteUrl(
    env({
      NODE_ENV: 'development',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    }),
  ),
  'http://localhost:3000',
);

// Dev default when nothing set
assert.equal(resolveSiteUrl(env({ NODE_ENV: 'development' })), 'http://localhost:3000');

console.log('resolve-site-url.spec PASS');
