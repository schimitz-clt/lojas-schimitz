import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOOTER_TRUST_WHATSAPP_FALLBACK, footerTrustItems } from './footer-trust';
import { formatWhatsAppDisplay } from './whatsapp';
import { INTEREST_FREE_INSTALLMENTS } from './pricing';

{
  const items = footerTrustItems();
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((i) => i.id),
    ['pay', 'whatsapp', 'delivery'],
  );
  assert.ok(/PIX/i.test(items[0].title) && /cart[aã]o/i.test(items[0].title));
  assert.ok(/PIX 5%/.test(items[0].body));
  assert.ok(items[0].body.includes(`${INTEREST_FREE_INSTALLMENTS}x sem juros`));
  assert.ok(!/12x/.test(items[0].body));

  assert.equal(items[1].title, 'WhatsApp atendimento');
  assert.equal(items[1].body, FOOTER_TRUST_WHATSAPP_FALLBACK);
  assert.equal(items[1].href, undefined);

  const withWa = footerTrustItems({
    whatsappHref: 'https://wa.me/5551996253766?text=oi',
    whatsappDisplay: '(51) 99625-3766',
  });
  assert.equal(withWa[1].href, 'https://wa.me/5551996253766?text=oi');
  assert.equal(withWa[1].external, true);
  assert.equal(withWa[1].body, '(51) 99625-3766');

  assert.ok(/POA|Porto Alegre/i.test(items[2].body));
  assert.ok(/Mercado Pago/i.test(items[2].body));
  assert.ok(!items.some((i) => /pessoas vendo|100%\s*seguro|selo/i.test(`${i.title} ${i.body}`)));
}

assert.equal(formatWhatsAppDisplay('5551996253766'), '(51) 99625-3766');
assert.equal(formatWhatsAppDisplay('(51) 99625-3766'), '(51) 99625-3766');
assert.equal(formatWhatsAppDisplay('51996253766'), '(51) 99625-3766');
assert.equal(formatWhatsAppDisplay(null), '(51) 99625-3766');

{
  const srcRoot = join(__dirname, '..');
  const chrome = readFileSync(join(srcRoot, 'components/StorefrontChrome.tsx'), 'utf8');
  assert.ok(chrome.includes('FooterTrustStrip'), 'footer chrome mounts the trust strip');
  assert.ok(chrome.includes('className="footer"'), 'existing footer stays');
  assert.ok(chrome.includes('footer-grid'), 'existing footer columns stay');

  const strip = readFileSync(join(srcRoot, 'components/FooterTrustStrip.tsx'), 'utf8');
  assert.ok(strip.includes('footerTrustItems'), 'strip uses the helper');
  assert.ok(strip.includes('waLink'), 'WhatsApp uses existing storefront wa.me helper');
  assert.ok(strip.includes('formatWhatsAppDisplay'), 'display number comes from store digits');
  assert.ok(!/pessoas vendo/i.test(strip), 'no fake viewers');

  const css = readFileSync(join(srcRoot, 'app/globals.css'), 'utf8');
  assert.ok(css.includes('.footer-trust'), 'footer trust is styled');
  assert.ok(
    /@media \(max-width: 720px\)[\s\S]*\.footer-trust\s*\{[^}]*grid-template-columns:\s*1fr/.test(css),
    'mobile trust strip stacks in one clean column',
  );
}

console.log('footer-trust unit tests ok');
