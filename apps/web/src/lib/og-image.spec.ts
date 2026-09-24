import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  absoluteShareImageUrl,
  BRAND_SHARE_IMAGE_HEIGHT,
  BRAND_SHARE_IMAGE_WIDTH,
  isImageUrl,
  isSiteRootUrl,
  resolveProductShareImage,
  resolveShareImage,
  shareImageMetadata,
  shareImageTag,
  shareImageUrl,
} from './og-image';

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
assert.ok(layout.includes('resolveShareImage(s.ogImageUrl, base)'), 'layout guards ogImageUrl before emitting share tags');
assert.ok(layout.includes('shareImageTag(share)'), 'og:image uses the resolved absolute URL');
assert.ok(layout.includes('share.twitterCard'), 'twitter card follows the guard');
assert.ok(layout.includes('images: [share.url]'), 'twitter:image uses the resolved URL');
assert.equal(layout.includes("card: s.ogImageUrl ? 'summary_large_image'"), false);
assert.equal(layout.includes("canonical: '/'"), false, 'root layout must not canonical every route to home');

const home = readFileSync(join(__dirname, '../app/page.tsx'), 'utf8');
assert.ok(home.includes("canonical: '/'"), 'home keeps the only root canonical');

assert.equal(
  absoluteShareImageUrl('/android-chrome-512x512.png', origin),
  `${origin}/android-chrome-512x512.png`,
);
assert.equal(absoluteShareImageUrl(`${origin}/`, origin), null);
assert.equal(absoluteShareImageUrl('https://placehold.co/600x400.png', origin), null);

const liveRoot = resolveShareImage(`${origin}/`, origin);
assert.equal(liveRoot.url, `${origin}/og-loja.png`);
assert.equal(liveRoot.branded, true);
assert.equal(liveRoot.twitterCard, 'summary_large_image');
const liveTag = shareImageTag(liveRoot);
assert.equal(liveTag.width, BRAND_SHARE_IMAGE_WIDTH);
assert.equal(liveTag.height, BRAND_SHARE_IMAGE_HEIGHT);

const photo = resolveShareImage(`${origin}/capa.jpg`, origin);
assert.equal(photo.url, `${origin}/capa.jpg`);
assert.equal(photo.branded, false);
assert.equal(shareImageTag(photo).width, undefined);

const missingProduct = resolveProductShareImage(null, origin, 'Alarme residencial sem fio');
assert.equal(missingProduct.url, `${origin}/og-loja.png`);
assert.equal(missingProduct.branded, true);

const productUpload = resolveProductShareImage('/api/v1/uploads/foto', origin, 'Smart TV');
assert.equal(productUpload.url, `${origin}/api/v1/uploads/foto`);
assert.equal(productUpload.branded, false);
assert.equal(productUpload.alt, 'Smart TV');

const placeholder = resolveProductShareImage('https://placehold.co/600x400', origin, 'TV');
assert.equal(placeholder.branded, true);

const card = readFileSync(join(__dirname, '../../public/og-loja.png'));
assert.equal(card.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(card.readUInt32BE(16), BRAND_SHARE_IMAGE_WIDTH);
assert.equal(card.readUInt32BE(20), BRAND_SHARE_IMAGE_HEIGHT);

console.log('og-image unit tests ok');
