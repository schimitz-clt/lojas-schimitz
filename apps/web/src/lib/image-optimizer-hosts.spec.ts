import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { IMAGE_OPTIMIZER_REMOTE_HOSTS } from './image-optimizer-hosts';
import { IMAGE_WIDTHS, ownUploadPath, responsiveImageProps } from './responsive-image';

const config = readFileSync(join(__dirname, '../../next.config.ts'), 'utf8');

// No open image proxy: the wildcard host must never come back.
assert.ok(!/hostname:\s*['"]\*\*?['"]/.test(config), 'next.config must not allow any-host images');
assert.ok(config.includes('IMAGE_OPTIMIZER_REMOTE_HOSTS'), 'next.config uses the shared host list');
assert.ok(config.includes("localPatterns: [{ pathname: '/api/v1/uploads/**' }]"), 'local optimizer limited to uploads');
assert.ok(config.includes("pathname: '/api/v1/uploads/**'"), 'remote optimizer limited to uploads path');

// Exactly the store's own public hosts.
assert.deepEqual([...IMAGE_OPTIMIZER_REMOTE_HOSTS].sort(), [
  'lojas-schimitz-production.up.railway.app',
  'lojasschimitz.com.br',
  'www.lojasschimitz.com.br',
]);

// Every host the storefront optimizes is allowed by the config (keeps both lists in sync).
for (const h of IMAGE_OPTIMIZER_REMOTE_HOSTS) {
  assert.equal(ownUploadPath(`https://${h}/api/v1/uploads/a.png`), '/api/v1/uploads/a.png', h);
}

// What the storefront actually sends to /_next/image is always a relative uploads path.
const props = responsiveImageProps('https://lojasschimitz.com.br/api/v1/uploads/a.png', IMAGE_WIDTHS.banner);
const urls = (props.srcSet || '').split(',').map((s) => s.trim().split(' ')[0]);
assert.ok(urls.length > 0);
for (const u of urls) {
  const inner = decodeURIComponent(new URL(u, 'https://x').searchParams.get('url') || '');
  assert.ok(inner.startsWith('/api/v1/uploads/'), `optimizer url is a local uploads path: ${inner}`);
}

// External images (e.g. placehold.co in prod) are never routed through the optimizer.
assert.equal(ownUploadPath('https://placehold.co/600x600?text=Produto'), null);
assert.equal(ownUploadPath('https://example.com/a.png'), null);

console.log('image-optimizer-hosts.spec OK');
