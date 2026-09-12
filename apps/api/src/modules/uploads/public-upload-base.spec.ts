import assert from 'assert';
import { PUBLIC_UPLOAD_ORIGIN } from '../../common/public-upload-url';
import { buildPublicUploadUrl, resolvePublicUploadOrigin } from './public-upload-base';

const file = '518992fa-c11b-4ca5-8113-18e5a1e6c6db.png';

function env(partial: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...partial } as NodeJS.ProcessEnv;
}

assert.equal(
  resolvePublicUploadOrigin(
    env({
      SITE_URL: 'https://lojasschimitz.com.br/',
      APP_URL: 'https://other.example',
    }),
  ),
  'https://lojasschimitz.com.br',
);

assert.equal(
  resolvePublicUploadOrigin(env({ APP_URL: 'https://lojasschimitz.com.br' })),
  'https://lojasschimitz.com.br',
);

assert.equal(
  resolvePublicUploadOrigin(env({ NEXT_PUBLIC_SITE_URL: 'https://lojasschimitz.com.br/api/v1' })),
  'https://lojasschimitz.com.br',
);

assert.equal(
  resolvePublicUploadOrigin(env({ PUBLIC_WEB_URL: 'https://www.lojasschimitz.com.br' })),
  PUBLIC_UPLOAD_ORIGIN,
);

assert.equal(
  resolvePublicUploadOrigin(
    env({
      NODE_ENV: 'production',
      SITE_URL: 'http://localhost:3000',
      APP_URL: 'https://lojasschimitz.com.br',
    }),
  ),
  'https://lojasschimitz.com.br',
);

assert.equal(
  resolvePublicUploadOrigin(
    env({
      SITE_URL: 'https://lojas-schimitz-production.up.railway.app',
      NEXT_PUBLIC_SITE_URL: 'https://lojasschimitz.com.br',
    }),
  ),
  'https://lojasschimitz.com.br',
);

assert.equal(resolvePublicUploadOrigin(env({ SITE_URL: 'null', APP_URL: '' })), null);
assert.equal(resolvePublicUploadOrigin(env({})), null);

const apexUrl = buildPublicUploadUrl(
  file,
  env({ SITE_URL: 'https://lojasschimitz.com.br', API_PREFIX: 'api/v1' }),
);
assert.equal(apexUrl, `${PUBLIC_UPLOAD_ORIGIN}/api/v1/uploads/${file}`);

const fallbackApi = buildPublicUploadUrl(
  file,
  env({ PUBLIC_API_URL: 'https://lojas-schimitz-production.up.railway.app/api/v1' }),
);
assert.equal(
  fallbackApi,
  `https://lojas-schimitz-production.up.railway.app/api/v1/uploads/${file}`,
);

const fromReq = buildPublicUploadUrl(
  file,
  env({}),
  {
    protocol: 'https',
    headers: { 'x-forwarded-host': 'lojas-schimitz-production.up.railway.app', 'x-forwarded-proto': 'https' },
  },
);
assert.equal(
  fromReq,
  `https://lojas-schimitz-production.up.railway.app/api/v1/uploads/${file}`,
);

assert.equal(
  buildPublicUploadUrl('../secret.png', env({ SITE_URL: 'https://lojasschimitz.com.br' })),
  `${PUBLIC_UPLOAD_ORIGIN}/api/v1/uploads/secret.png`,
);
assert.equal(
  buildPublicUploadUrl('foo/../../../etc/passwd', env({ SITE_URL: 'https://lojasschimitz.com.br' })),
  `${PUBLIC_UPLOAD_ORIGIN}/api/v1/uploads/passwd`,
);
assert.equal(
  buildPublicUploadUrl('..', env({ SITE_URL: 'https://lojasschimitz.com.br' })),
  `${PUBLIC_UPLOAD_ORIGIN}/api/v1/uploads/file.bin`,
);

console.log('public-upload-base unit tests ok');
