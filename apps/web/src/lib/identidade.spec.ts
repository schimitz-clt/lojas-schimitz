import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  campaignChapters,
  campaignPath,
  displayHeadline,
  lineupLabel,
  pixOffLabel,
  posterToken,
  specNumeral,
  specNumerals,
  splitBrl,
} from './identidade';

assert.deepEqual(displayHeadline('Smart TV 43 polegadas 4K UHD'), {
  lead: 'Smart TV 43 polegadas',
  accent: '4K UHD',
});
assert.deepEqual(displayHeadline('Fone — silêncio real'), {
  lead: 'Fone',
  accent: 'silêncio real',
});
assert.deepEqual(displayHeadline('Copo'), { lead: 'Copo', accent: null });
assert.equal(displayHeadline('').lead, '');

assert.equal(posterToken('Smart TV 43" 4K'), '43"');
assert.equal(posterToken('Powerbank 20000 mAh'), '20000mAh');
assert.equal(posterToken('Cafeteira'), 'Cafeteira');
assert.equal(posterToken(''), null);
assert.equal(posterToken('Ab'), null);

assert.deepEqual(specNumeral({ label: 'Bateria', value: '30 h' }), {
  label: 'Bateria',
  number: '30',
  unit: 'h',
});
assert.deepEqual(specNumeral({ label: 'Ruído', value: '-25 dB' }), {
  label: 'Ruído',
  number: '−25',
  unit: 'dB',
});
assert.equal(specNumeral({ label: 'Cor', value: 'Grafite' }), null);
assert.equal(specNumeral({ label: 'Nota', value: 'sem número' }), null);
assert.equal(
  specNumerals(
    [
      { label: 'Bateria', value: '30 h' },
      { label: 'Cor', value: 'Grafite' },
      { label: 'Driver', value: '40 mm' },
    ],
    3,
  ).length,
  2,
);

const chapters = campaignChapters({
  features: [{ label: 'Tela', value: '43 pol' }],
  highlights: ['Wi-Fi'],
  description: 'Painel real do catálogo.',
  boxContents: ['Controle'],
});
assert.deepEqual(
  chapters.map((chapter) => chapter.id),
  ['specs', 'highlights', 'story', 'box'],
);
assert.equal(campaignChapters({ description: '   ' }).length, 0);
assert.equal(
  campaignChapters({ features: [{ label: 'Cor', value: 'Preto' }] }).some((chapter) => chapter.id === 'specs'),
  false,
);

assert.equal(campaignPath('tv 43'), '/campanha/tv%2043');
assert.equal(lineupLabel(1, 5), '01 / 05');
assert.equal(lineupLabel(3, 3), '03 / 03');
assert.equal(pixOffLabel(), 'No PIX · 5% off');
assert.deepEqual(splitBrl(1899), { whole: '1.899', cents: ',00' });
assert.deepEqual(splitBrl(10.5), { whole: '10', cents: ',50' });

const src = join(__dirname, '..');
const chrome = readFileSync(join(src, 'components/StorefrontChrome.tsx'), 'utf8');
assert.ok(chrome.includes('<UtmCapture />'), 'campaign landings keep the existing UTM capture');
const campaignPage = readFileSync(join(src, 'app/campanha/[slug]/page.tsx'), 'utf8');
const campaign = readFileSync(join(src, 'app/campanha/[slug]/CampaignView.tsx'), 'utf8');
assert.ok(campaignPage.includes('fetchPublicProduct'), 'campaign reads the public catalog');
assert.ok(campaignPage.includes('isDemo'), 'campaign does not sell demo rows');
assert.ok(!campaign.includes('1.899'), 'campaign source has no mock price');
assert.ok(!campaign.includes('Cinema em casa'), 'campaign source has no mock headline');
assert.ok(campaign.includes('installmentLine'), 'campaign uses the real installment helper');
assert.ok(campaign.includes('formatWhatsAppDisplay'), 'campaign shows the store WhatsApp');

const page = readFileSync(join(src, 'app/page.tsx'), 'utf8');
assert.ok(page.includes('shouldUseRetailHome'), 'boutique home still uses the 1–5 catalog gate');
assert.ok(page.includes('EditorialStage'), 'abertura renders the sellable preview');

const home = readFileSync(join(src, 'components/RetailHome.tsx'), 'utf8');
assert.ok(home.includes('pixPrice'), 'home price is the PIX helper');
assert.ok(home.includes('installmentLine'), 'home installments are the real rule');
assert.ok(home.includes('id-lcp'), 'home hero image is marked so motion does not target it');

const css = readFileSync(join(src, 'components/storefront/identidade.css'), 'utf8');
assert.ok(css.includes('prefers-reduced-motion'), 'identity motion respects reduced motion');
assert.ok(/\.id-lcp[\s\S]*animation:\s*none/.test(css), 'LCP image is not animated');

console.log('identidade unit tests ok');
