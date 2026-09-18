import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Marketing chrome must not sell “atendimento por WhatsApp” as a benefit.
 * Contact buttons / footer phone number stay allowed.
 */
const marketingFiles = [
  'components/Header.tsx',
  'components/HomeBanners.tsx',
  'components/TrustBadges.tsx',
  'components/StorefrontChrome.tsx',
  'components/ProductCard.tsx',
  'app/page.tsx',
  'app/produto/[slug]/ProductClient.tsx',
];

const banned = [
  /atendimento\s+whatsapp/i,
  /atendimento\s+por\s+whatsapp/i,
  /atendimento\s+via\s+whatsapp/i,
];

const srcRoot = join(__dirname, '..');
for (const f of marketingFiles) {
  const src = readFileSync(join(srcRoot, f), 'utf8');
  for (const re of banned) {
    assert.ok(!re.test(src), `${f} must not advertise atendimento WhatsApp`);
  }
}

const header = readFileSync(join(srcRoot, 'components/Header.tsx'), 'utf8');
assert.ok(header.includes('Troca em 7 dias'), 'topbar keeps a real benefit after WhatsApp marketing removal');
assert.ok(/className="btn wa[\w\s-]*"/.test(header), 'header WhatsApp contact button remains');

const chrome = readFileSync(join(srcRoot, 'components/StorefrontChrome.tsx'), 'utf8');
assert.ok(/99625-3766/.test(chrome), 'footer keeps the store number');
assert.ok(/wa\.me\/5551996253766/.test(chrome), 'footer WhatsApp contact link remains');

console.log('storefront-copy unit tests ok');
