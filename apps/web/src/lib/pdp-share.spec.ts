import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PDP_SHARE_ORIGIN,
  pdpProductCanonicalUrl,
  pdpShareButtonLabel,
  pdpShareClipboardText,
  pdpShareCopiedLabel,
  pdpSharePayload,
  pdpSharePixLabel,
  pdpShareWhatsAppHref,
  pdpWhatsAppShareLabel,
  shareProductPage,
} from './pdp-share';

assert.equal(PDP_SHARE_ORIGIN, 'https://lojasschimitz.com.br');
assert.equal(
  pdpProductCanonicalUrl('sansung-a54'),
  'https://lojasschimitz.com.br/produto/sansung-a54',
);
assert.equal(pdpProductCanonicalUrl('/sansung-a54/'), 'https://lojasschimitz.com.br/produto/sansung-a54');
assert.equal(pdpProductCanonicalUrl('  '), '');
assert.equal(pdpProductCanonicalUrl('foo/bar'), '');
assert.equal(pdpProductCanonicalUrl('x?utm=1'), '');
assert.ok(!pdpProductCanonicalUrl('sansung-a54').includes('localhost'));
assert.ok(!pdpProductCanonicalUrl('sansung-a54').includes('www.'));

const payload = pdpSharePayload('Sansung A54', 'https://lojasschimitz.com.br/produto/sansung-a54');
assert.equal(payload.title, 'Sansung A54');
assert.ok(!payload.title.includes('|'));
assert.ok(payload.text.includes('Lojas Schimitz'));
assert.ok(payload.text.length < 80, 'share text stays short');
assert.equal(payload.url, 'https://lojasschimitz.com.br/produto/sansung-a54');
assert.equal(pdpSharePayload('  ', '').title, 'Produto');
assert.equal(payload.text.includes('no PIX'), false);

assert.equal(pdpSharePixLabel(null), null);
assert.equal(pdpSharePixLabel(0), null);
assert.equal(pdpSharePixLabel(''), null);
assert.equal(pdpSharePixLabel('abc'), null);
const pix899 = pdpSharePixLabel(899);
assert.ok(pix899, 'PIX label exists for a priced product');
assert.ok(pix899!.includes('854,05'), 'PIX label is the existing 5% price');

const payloadPix = pdpSharePayload(
  'Aspirador robô',
  'https://lojasschimitz.com.br/produto/aspirador',
  pix899,
);
assert.ok(payloadPix.text.includes('Lojas Schimitz'));
assert.ok(payloadPix.text.includes('854,05'));
assert.ok(payloadPix.text.includes('no PIX'));
assert.ok(payloadPix.text.length < 120, 'PIX share text stays a short sentence');
assert.equal(payloadPix.url.includes('854'), false, 'price stays out of the URL');

const clip = pdpShareClipboardText(payloadPix);
assert.ok(clip.includes('Aspirador robô'));
assert.ok(clip.includes('no PIX'));
assert.ok(clip.includes('lojasschimitz.com.br/produto/aspirador'));
assert.notEqual(clip, payloadPix.url, 'clipboard is the rich text, not a bare URL');

const wa = pdpShareWhatsAppHref('Sansung A54', 'https://lojasschimitz.com.br/produto/sansung-a54');
assert.ok(wa.startsWith('https://wa.me/?text='));
assert.ok(!wa.includes('5551996253766'), 'share does not message the store number');
assert.ok(decodeURIComponent(wa).includes('Sansung A54'));
assert.ok(decodeURIComponent(wa).includes('Olha este produto na Lojas Schimitz'));
assert.ok(decodeURIComponent(wa).includes('lojasschimitz.com.br/produto/sansung-a54'));
assert.equal(decodeURIComponent(wa).includes('no PIX'), false);

const waPix = pdpShareWhatsAppHref(
  'Aspirador robô',
  'https://lojasschimitz.com.br/produto/aspirador',
  pix899,
);
const waPixText = decodeURIComponent(waPix);
assert.ok(waPix.startsWith('https://wa.me/?text='));
assert.ok(waPixText.includes('Aspirador robô'));
assert.ok(waPixText.includes('854,05'));
assert.ok(waPixText.includes('no PIX'));
assert.ok(waPixText.includes('lojasschimitz.com.br/produto/aspirador'));

assert.equal(pdpShareButtonLabel(), 'Compartilhar');
assert.equal(pdpWhatsAppShareLabel(), 'Compartilhar no WhatsApp');
assert.equal(pdpShareCopiedLabel(), 'Texto copiado');

async function runShareCases() {
  const canonical = pdpProductCanonicalUrl('tv');

  assert.equal(
    await shareProductPage({
      productName: 'TV',
      url: canonical,
      canShareNative: true,
      shareNative: async (data) => {
        assert.equal(data.title, 'TV');
        assert.equal(data.url, 'https://lojasschimitz.com.br/produto/tv');
        assert.ok(data.text.includes('Lojas Schimitz'));
        assert.notEqual(data.text, data.url, 'native share text is not a bare URL');
        assert.ok(data.text.includes('854,05'));
        assert.ok(data.text.includes('no PIX'));
      },
      pixLabel: pdpSharePixLabel(899),
    }),
    'shared',
  );

  assert.equal(
    await shareProductPage({
      productName: 'TV',
      url: canonical,
      canShareNative: true,
      shareNative: async () => {
        const err = new Error('Abort');
        err.name = 'AbortError';
        throw err;
      },
    }),
    'cancelled',
  );

  assert.equal(
    await shareProductPage({
      productName: 'TV',
      url: canonical,
      canShareNative: false,
      copyText: async (t) => {
        assert.ok(t.includes('TV'));
        assert.ok(t.includes('Lojas Schimitz'));
        assert.ok(t.includes('https://lojasschimitz.com.br/produto/tv'));
        assert.notEqual(t, 'https://lojasschimitz.com.br/produto/tv');
      },
    }),
    'copied',
  );

  assert.equal(
    await shareProductPage({
      productName: 'TV',
      url: canonical,
      canShareNative: false,
      copyText: async () => {
        throw new Error('denied');
      },
    }),
    'whatsapp',
  );

  assert.equal(
    await shareProductPage({
      productName: 'TV',
      url: '',
      canShareNative: false,
    }),
    'failed',
  );
}

runShareCases()
  .then(() => {
    const srcRoot = join(__dirname, '..');
    const pdp = readFileSync(join(srcRoot, 'app/produto/[slug]/ProductClient.tsx'), 'utf8');
    assert.ok(pdp.includes('ProductShareButton'), 'PDP has Compartilhar control');
    assert.ok(
      pdp.includes('productSlug={p.slug}'),
      'share uses the product slug for the canonical URL',
    );
    assert.ok(
      pdp.includes('variant="icon"'),
      'mobile gallery overlay uses the Magalu-style icon share',
    );
    assert.ok(pdp.includes('pdp-gallery-tools'), 'share sits on/near the photo on mobile');
    const tools = pdp.slice(pdp.indexOf('pdp-gallery-tools'), pdp.indexOf('pdp-buybox'));
    const heartAt = tools.indexOf('FavoriteToggle');
    const waAt = tools.indexOf('ProductWhatsAppShareButton');
    const shareAt = tools.indexOf('<ProductShareButton');
    assert.ok(heartAt >= 0 && waAt > heartAt && shareAt > waAt, 'overlay order is heart, WhatsApp, share');
    assert.ok(pdp.includes('pdpSharePixLabel'), 'share copy uses the PIX display price');

    const btn = readFileSync(join(srcRoot, 'components/ProductShareButton.tsx'), 'utf8');
    assert.ok(btn.includes('pdpProductCanonicalUrl'), 'button shares the apex product URL');
    assert.ok(btn.includes('showStorefrontToast'), 'copy fallback uses the storefront toast');
    assert.ok(btn.includes('pdpShareCopiedLabel'), 'toast copy uses the shared label');
    assert.ok(btn.includes('navigator.share'), 'prefers Web Share API');
    assert.ok(btn.includes('pdpSharePayload'), 'native share gets title + text + url');
    assert.ok(btn.includes('pixLabel'), 'PIX price is part of the share payload');
    assert.ok(btn.includes('pdpShareWhatsAppHref'), 'WhatsApp is the last fallback');
    assert.ok(btn.includes('ProductWhatsAppShareButton'), 'direct WhatsApp control');
    assert.ok(btn.includes('target="_blank"'), 'WhatsApp opens in a new tab');
    assert.ok(btn.includes('noopener noreferrer'), 'WhatsApp link drops the opener');
    assert.ok(btn.includes('pdpWhatsAppShareLabel'), 'WhatsApp control has a PT label');
    assert.equal(btn.includes('window.location.href'), false, 'must not share localhost/query href');
    assert.equal(btn.includes('5551996253766'), false, 'PDP share does not dial the store');
    assert.ok(btn.includes('Compartilhar') || btn.includes('pdpShareButtonLabel()'), 'PT label');

    const css = readFileSync(join(srcRoot, 'app/globals.css'), 'utf8');
    assert.ok(
      /@media \(max-width: 720px\)[\s\S]*\.pdp-gallery-tools\s*\{[^}]*pointer-events:\s*none/.test(css),
      'gallery overlay does not steal swipe from the photo track',
    );
    assert.ok(
      /@media \(max-width: 720px\)[\s\S]*\.pdp-gallery-tools \.pdp-share-btn\s*\{[^}]*pointer-events:\s*auto/.test(css),
      'share circle stays tappable',
    );
    assert.ok(
      /@media \(max-width: 720px\)[\s\S]*\.pdp-gallery-tools \.pdp-wa-share-btn,[\s\S]*?pointer-events:\s*auto/.test(css),
      'WhatsApp circle is tappable on the photo',
    );
    assert.ok(
      /@media \(max-width: 720px\)[\s\S]*\.pdp-title-row \.pdp-share\s*\{[^}]*display:\s*none/.test(css),
      'mobile uses the photo overlay, not a second title-row share',
    );
    assert.ok(
      /@media \(max-width: 720px\)[\s\S]*\.pdp-title-row \.pdp-wa-share\s*\{[^}]*display:\s*none/.test(css),
      'mobile uses the photo overlay, not a second title-row WhatsApp',
    );
    console.log('pdp-share unit tests ok');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
