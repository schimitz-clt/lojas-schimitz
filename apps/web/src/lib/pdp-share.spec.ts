import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PDP_SHARE_ORIGIN,
  pdpProductCanonicalUrl,
  pdpShareButtonLabel,
  pdpShareCopiedLabel,
  pdpSharePayload,
  pdpShareWhatsAppHref,
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

const wa = pdpShareWhatsAppHref('Sansung A54', 'https://lojasschimitz.com.br/produto/sansung-a54');
assert.ok(wa.startsWith('https://wa.me/?text='));
assert.ok(decodeURIComponent(wa).includes('Sansung A54'));
assert.ok(decodeURIComponent(wa).includes('Olha este produto na Lojas Schimitz'));
assert.ok(decodeURIComponent(wa).includes('lojasschimitz.com.br/produto/sansung-a54'));

assert.equal(pdpShareButtonLabel(), 'Compartilhar');
assert.equal(pdpShareCopiedLabel(), 'Link copiado');

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
      },
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
        assert.equal(t, 'https://lojasschimitz.com.br/produto/tv');
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

    const btn = readFileSync(join(srcRoot, 'components/ProductShareButton.tsx'), 'utf8');
    assert.ok(btn.includes('pdpProductCanonicalUrl'), 'button shares the apex product URL');
    assert.ok(btn.includes('showStorefrontToast'), 'copy fallback uses the storefront toast');
    assert.ok(btn.includes('pdpShareCopiedLabel'), 'toast copy is Link copiado');
    assert.ok(btn.includes('navigator.share'), 'prefers Web Share API');
    assert.ok(btn.includes('pdpShareWhatsAppHref'), 'WhatsApp is the last fallback');
    assert.equal(btn.includes('window.location.href'), false, 'must not share localhost/query href');
    assert.ok(btn.includes('Compartilhar') || btn.includes('pdpShareButtonLabel()'), 'PT label');

    const css = readFileSync(join(srcRoot, 'app/globals.css'), 'utf8');
    assert.ok(
      /@media \(max-width: 720px\)[\s\S]*\.pdp-gallery-tools\s*\{[^}]*pointer-events:\s*none/.test(css),
      'gallery overlay does not steal swipe from the photo track',
    );
    assert.ok(
      /@media \(max-width: 720px\)[\s\S]*\.pdp-gallery-tools \.pdp-share-btn\s*\{[^}]*pointer-events:\s*auto/.test(css),
      'only the share circle is tappable',
    );
    assert.ok(
      /@media \(max-width: 720px\)[\s\S]*\.pdp-title-row \.pdp-share\s*\{[^}]*display:\s*none/.test(css),
      'mobile uses the photo overlay, not a second title-row share',
    );
    console.log('pdp-share unit tests ok');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
