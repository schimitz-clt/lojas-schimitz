import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACCOUNT_DELETION_PATH,
  PRIVACY_INTRO,
  PRIVACY_SECTIONS,
  privacyPolicyPlainText,
} from './privacy-policy';
import {
  cleanEmail,
  formatCnpj,
  formatWhatsappDisplay,
  legalContactLines,
  storeLegalIdentity,
} from './store-legal-identity';

const id = storeLegalIdentity({});
const text = privacyPolicyPlainText({ lines: legalContactLines(id) });
const lower = text.toLowerCase();

// App é WebView nativo, não TWA.
assert.ok(!/trusted web activity/i.test(text), 'não pode citar Trusted Web Activity');
assert.match(PRIVACY_INTRO, /WebView/);

// Dados realmente coletados pelo sistema.
for (const term of [
  'cpf',
  'data de nascimento',
  'endereços de entrega',
  'mercado pago',
  'firebase cloud messaging',
  'produtos vistos',
  'avaliações',
  'resend',
  'melhor envio',
  'openai',
  'endereço ip',
  'railway',
  'sch_access',
  'sch_refresh',
  'sch_push_device',
]) {
  assert.ok(lower.includes(term), `política deve citar: ${term}`);
}

// Bases legais LGPD, direitos, ANPD, transferência internacional, retenção, exclusão.
for (const art of ['art. 7º, I)', 'art. 7º, II', 'art. 7º, V)', 'art. 7º, IX)', 'art. 18', 'art. 33']) {
  assert.ok(text.includes(art), `faltou ${art}`);
}
assert.ok(lower.includes('anpd'));
assert.ok(text.includes(`https://lojasschimitz.com.br${ACCOUNT_DELETION_PATH}`));
assert.equal(ACCOUNT_DELETION_PATH, '/excluir-conta');
const retention = PRIVACY_SECTIONS.find((s) => s.id === 'retencao');
assert.ok(retention?.items?.some((i) => /30 dias/.test(i)));
assert.ok(retention?.items?.some((i) => /1 hora/.test(i)));
assert.ok(retention?.items?.some((i) => /Produtos vistos/.test(i) && /90 dias/.test(i)), 'retenção de 90 dias dos produtos vistos');
for (const s of PRIVACY_SECTIONS) {
  for (const r of s.rows || []) assert.ok(r.basis.includes('art. 7º'), `base legal ausente: ${r.data}`);
}

// Nada de dado da empresa inventado: sem env, só WhatsApp do site.
assert.equal(id.cnpj, null);
assert.equal(id.address, null);
assert.equal(id.privacyEmail, null);
assert.equal(id.legalName, null);
assert.equal(id.whatsappDisplay, '(51) 99625-3766');
assert.equal(id.whatsappHref, 'https://wa.me/5551996253766');
assert.ok(!/@/.test(text), 'sem e-mail fixo no texto');
assert.ok(!/cnpj:/i.test(text));
assert.ok(!/pessoa física/i.test(text));

// Campos configuráveis.
const cfg = storeLegalIdentity({
  NEXT_PUBLIC_STORE_LEGAL_NAME: '  Loja  Teste ',
  NEXT_PUBLIC_STORE_CNPJ: '11222333000181',
  NEXT_PUBLIC_STORE_ADDRESS: 'Rua A, 1',
  NEXT_PUBLIC_STORE_PRIVACY_EMAIL: 'Privacidade@Exemplo.com',
});
assert.equal(cfg.legalName, 'Loja Teste');
assert.equal(cfg.cnpj, '11.222.333/0001-81');
assert.equal(cfg.privacyEmail, 'privacidade@exemplo.com');
assert.deepEqual(legalContactLines(cfg).slice(0, 3), [
  'Controlador: Loja Teste',
  'CNPJ: 11.222.333/0001-81',
  'Endereço: Rua A, 1',
]);
assert.equal(formatCnpj('123'), null);
assert.equal(formatCnpj('00000000000000'), null);
assert.equal(cleanEmail('não é email'), null);
assert.equal(formatWhatsappDisplay('5551996253766'), '(51) 99625-3766');

// A página renderiza esta fonte e não tem contato fixo.
const page = readFileSync(join(__dirname, '../app/privacidade/page.tsx'), 'utf8');
assert.ok(page.includes('PRIVACY_SECTIONS'));
assert.ok(page.includes('storeLegalIdentity()'));
assert.ok(!/gmail|Trusted Web Activity|wa\.me\/55/i.test(page));

console.log('privacy-policy.spec ok');
