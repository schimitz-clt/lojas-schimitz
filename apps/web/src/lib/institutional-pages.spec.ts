import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  FRETE_SECTIONS,
  PREENCHER,
  SOBRE_SECTIONS,
  TROCAS_SECTIONS,
  orPreencher,
  storeIdentityRows,
} from './institutional-pages';
import { SITEMAP_STATIC_PAGES } from './catalog-sitemap';
import { storeLegalIdentity } from './store-legal-identity';

const text = (s: typeof SOBRE_SECTIONS) => s.flatMap((x) => [x.title, ...(x.paragraphs || []), ...(x.items || [])]).join('\n');

// Sem dados configurados: CNPJ/endereço/nome viram [PREENCHER], nunca inventados.
const rows = storeIdentityRows({
  legalName: null,
  cnpj: null,
  address: null,
  privacyEmail: null,
  cnpjNote: null,
  whatsappDigits: '5551996253766',
  whatsappDisplay: '(51) 99625-3766',
  whatsappHref: 'https://wa.me/5551996253766',
});
const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
assert.ok(byLabel['CNPJ ou CPF'].startsWith(PREENCHER));
assert.ok(byLabel['Endereço físico'].startsWith(PREENCHER));
assert.equal(byLabel.Cidade, 'Porto Alegre / RS');
assert.equal(byLabel.WhatsApp, '(51) 99625-3766');
assert.ok(!/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(rows.map((r) => r.value).join(' ')), 'nenhum CNPJ inventado');
assert.equal(orPreencher('  ', 'x'), `${PREENCHER} x`);
assert.equal(orPreencher('Rua A', 'x'), 'Rua A');

// CDC: arrependimento 7 dias com frete, prazos 30/90, art. 18.
const trocas = text(TROCAS_SECTIONS);
assert.match(trocas, /7 dias corridos/);
assert.match(trocas, /art\. 49/);
assert.match(trocas, /incluindo o frete/);
assert.match(trocas, /30 dias[\s\S]*90 dias/);
assert.match(trocas, /art\. 18/);
assert.ok(!/só (com|na) embalagem original|sem uso/i.test(trocas), 'arrependimento não exige condição extra');

const frete = text(FRETE_SECTIONS);
assert.match(frete, /CEP/);
assert.match(frete, /90 ou 91/);
assert.ok(frete.includes(PREENCHER), 'transportadoras desconhecidas ficam [PREENCHER]');
assert.match(text(SOBRE_SECTIONS), /Porto Alegre/);

for (const path of ['/sobre', '/trocas-e-devolucoes', '/frete']) {
  assert.ok(SITEMAP_STATIC_PAGES.some((p) => p.path === path), `sitemap tem ${path}`);
  assert.ok(existsSync(join(__dirname, `../app${path}/page.tsx`)), `rota ${path}`);
}
const chrome = readFileSync(join(__dirname, '../components/StorefrontChrome.tsx'), 'utf8');
for (const href of ['/sobre', '/trocas-e-devolucoes', '/frete']) assert.ok(chrome.includes(`href="${href}"`), `rodapé liga ${href}`);
const priv = readFileSync(join(__dirname, '../app/privacidade/page.tsx'), 'utf8');
assert.ok(priv.includes('{PREENCHER}'), 'privacidade mostra [PREENCHER] quando falta CNPJ/endereço');
console.log('institutional-pages.spec ok');

// CNPJ em registro: texto sem dígitos aparece; CPF/números inválidos nunca vazam.
{
  const sli = storeLegalIdentity;
  const note = sli({ NEXT_PUBLIC_STORE_CNPJ: 'CNPJ em processo de registro' });
  assert.equal(note.cnpj, null);
  assert.equal(note.cnpjNote, 'CNPJ em processo de registro');
  const r = Object.fromEntries(storeIdentityRows(note).map((x) => [x.label, x.value]));
  assert.equal(r['CNPJ ou CPF'], 'CNPJ em processo de registro');
  assert.equal(sli({ NEXT_PUBLIC_STORE_CNPJ: '123.456.789-09' }).cnpjNote, null);
  assert.equal(sli({ NEXT_PUBLIC_STORE_CNPJ: 'CPF: 123.456.789-09' }).cnpj, 'CPF: 123.456.789-09');
  assert.equal(sli({ NEXT_PUBLIC_STORE_CNPJ: '11222333000181' }).cnpj, '11.222.333/0001-81');
}
