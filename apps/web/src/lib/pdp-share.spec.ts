import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  pdpShareButtonLabel,
  pdpShareCopiedLabel,
  pdpSharePayload,
  pdpShareWhatsAppHref,
  shareProductPage,
} from './pdp-share';

const payload = pdpSharePayload('Sansung A54', 'https://lojasschimitz.com.br/produto/sansung-a54');
assert.equal(payload.title, 'Sansung A54 | Lojas Schimitz');
assert.ok(payload.text.includes('Sansung A54'));
assert.ok(payload.url.includes('/produto/sansung-a54'));
assert.equal(pdpSharePayload('  ', '').title, 'Produto | Lojas Schimitz');

const wa = pdpShareWhatsAppHref('Sansung A54', 'https://lojasschimitz.com.br/produto/sansung-a54');
assert.ok(wa.startsWith('https://wa.me/?text='));
assert.ok(decodeURIComponent(wa).includes('Sansung A54'));
assert.ok(decodeURIComponent(wa).includes('lojasschimitz.com.br/produto/sansung-a54'));

assert.equal(pdpShareButtonLabel(), 'Compartilhar');
assert.equal(pdpShareCopiedLabel(), 'Link copiado');

async function runShareCases() {
  assert.equal(
    await shareProductPage({
      productName: 'TV',
      url: 'https://loja.test/produto/tv',
      canShareNative: true,
      shareNative: async () => undefined,
    }),
    'shared',
  );

  assert.equal(
    await shareProductPage({
      productName: 'TV',
      url: 'https://loja.test/produto/tv',
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
      url: 'https://loja.test/produto/tv',
      canShareNative: false,
      copyText: async (t) => {
        assert.equal(t, 'https://loja.test/produto/tv');
      },
    }),
    'copied',
  );

  assert.equal(
    await shareProductPage({
      productName: 'TV',
      url: 'https://loja.test/produto/tv',
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
    const pdp = readFileSync(join(__dirname, '../app/produto/[slug]/ProductClient.tsx'), 'utf8');
    assert.ok(pdp.includes('ProductShareButton'), 'PDP has Compartilhar control');
    console.log('pdp-share unit tests ok');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
