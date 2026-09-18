import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Top promo strip only — do not advertise atendimento WhatsApp there. */
const header = readFileSync(join(__dirname, '..', 'components/Header.tsx'), 'utf8');
const topbar = header.match(/className="topbar"[\s\S]*?<\/div>/);
assert.ok(topbar, 'header topbar exists');
assert.ok(!/atendimento\s+whatsapp/i.test(topbar[0]), 'topbar must not say Atendimento WhatsApp');
assert.ok(!/whatsapp/i.test(topbar[0]), 'topbar must not mention WhatsApp');
assert.ok(/Frete grátis em POA/.test(topbar[0]), 'topbar keeps frete');
assert.ok(/PIX/.test(topbar[0]), 'topbar keeps PIX');
assert.ok(header.includes('interestFreeInstallmentClaim()'), 'topbar keeps 3x claim helper');
assert.ok(/className="btn wa[\w\s-]*"/.test(header), 'header WhatsApp contact button remains');
assert.ok(header.includes('<SearchBox'), 'header search uses live suggestions box');
assert.ok(!/Atendimento WhatsApp/.test(header), 'header file must not add Atendimento WhatsApp copy');

console.log('storefront-copy unit tests ok');
