import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isImageUrl, isSiteRootUrl, shareImageMetadata, shareImageUrl } from './og-image';

const origin = 'https://lojasschimitz.com.br';

assert.equal(shareImageUrl(null, origin), null);
assert.equal(shareImageUrl('   ', origin), null);
assert.equal(shareImageUrl(origin, origin), null);
assert.equal(shareImageUrl(`${origin}/`, origin), null);
assert.equal(shareImageUrl('http://localhost:3000', 'http://localhost:3000'), null);
assert.equal(shareImageUrl('http://localhost:3000/', 'http://localhost:3000'), null);
assert.equal(shareImageUrl('/', origin), null);
assert.equal(isSiteRootUrl(`${origin}/`, origin), true);
assert.equal(isSiteRootUrl(`${origin}/og.png`, origin), false);

assert.equal(shareImageUrl(`${origin}/produtos`, origin), null);
assert.equal(shareImageUrl('https://example.com/pagina', origin), null);
assert.equal(isImageUrl(`${origin}/produtos`, origin), false);
assert.equal(shareImageUrl('javascript:alert(1)', origin), null);
assert.equal(shareImageUrl('not a url', origin), null);

const png = `${origin}/android-chrome-512x512.png`;
assert.equal(shareImageUrl(png, origin), png);
assert.equal(shareImageUrl('/android-chrome-512x512.png', origin), '/android-chrome-512x512.png');
const upload = `${origin}/api/v1/uploads/capa.jpg`;
assert.equal(shareImageUrl(upload, origin), upload);
const cdn = 'https://cdn.example.com/share/og.webp?v=2';
assert.equal(shareImageUrl(cdn, origin), cdn);
assert.equal(shareImageUrl('https://cdn.example.com/OG.JPEG', origin), 'https://cdn.example.com/OG.JPEG');

const root = shareImageMetadata(`${origin}/`, origin);
assert.equal(root.imageUrl, null);
assert.equal(root.twitterCard, 'summary');

const page = shareImageMetadata(`${origin}/suporte`, origin);
assert.equal(page.imageUrl, null);
assert.equal(page.twitterCard, 'summary');

const image = shareImageMetadata(png, origin);
assert.equal(image.imageUrl, png);
assert.equal(image.twitterCard, 'summary_large_image');

const empty = shareImageMetadata(null, origin);
assert.equal(empty.imageUrl, null);
assert.equal(empty.twitterCard, 'summary');

const layout = readFileSync(join(__dirname, '../app/layout.tsx'), 'utf8');
assert.ok(layout.includes('shareImageMetadata'), 'layout guards ogImageUrl before emitting share tags');
assert.ok(layout.includes('share.imageUrl'), 'og:image and twitter:image use the guarded URL');
assert.ok(layout.includes('share.twitterCard'), 'twitter card follows the guard');
assert.equal(layout.includes("card: s.ogImageUrl ? 'summary_large_image'"), false);

console.log('og-image unit tests ok');
