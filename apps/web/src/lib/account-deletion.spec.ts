import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACCOUNT_DELETION_API,
  ACCOUNT_DELETION_DELETED,
  ACCOUNT_DELETION_KEPT,
  ACCOUNT_DELETION_PATH,
  ACCOUNT_DELETION_SLA_DAYS,
  ACCOUNT_DELETION_STEPS,
  accountDeletionStatusCopy,
  accountDeletionWhatsappHref,
  cleanDeletionReasonInput,
} from './account-deletion';
import { SITEMAP_STATIC_PAGES } from './catalog-sitemap';
import { accountMenuSections } from './account-menu';
import { adminAccountDeletionProcessPath } from './admin-account-deletion-ui';

assert.equal(ACCOUNT_DELETION_PATH, '/excluir-conta');
assert.equal(ACCOUNT_DELETION_API, '/me/account-deletion');

// Play Store: como pedir, o que é apagado, o que é mantido e por quanto tempo.
assert.ok(ACCOUNT_DELETION_STEPS.length >= 3);
const deleted = ACCOUNT_DELETION_DELETED.join(' ');
for (const t of ['CPF', 'data de nascimento', 'Endereços', 'token de notificação', 'Avaliações', 'sessões']) {
  assert.ok(deleted.includes(t), `apagado deve citar ${t}`);
}
const kept = ACCOUNT_DELETION_KEPT.join(' ');
assert.match(kept, /Pedidos, pagamentos/);
assert.match(kept, /5 anos/);
assert.match(kept, /cashback/i);
assert.ok(ACCOUNT_DELETION_STEPS.some((s) => s.includes(`${ACCOUNT_DELETION_SLA_DAYS} dias`)));

// WhatsApp do site (sem inventar contato).
const wa = accountDeletionWhatsappHref();
assert.ok(wa.startsWith('https://wa.me/5551996253766?text='));
assert.ok(decodeURIComponent(wa).includes('exclusão da minha conta'));

// Estados.
assert.match(accountDeletionStatusCopy({ status: 'none', openOrders: 0 }), /ativa/);
assert.match(accountDeletionStatusCopy({ status: 'none', openOrders: 2 }), /2 pedido/);
const pend = accountDeletionStatusCopy({
  status: 'pending',
  requestedAt: '2026-10-09T15:00:00.000Z',
  slaDays: 15,
  openOrders: 0,
});
assert.match(pend, /09\/10\/2026/);
assert.match(pend, /15 dias/);
assert.match(accountDeletionStatusCopy({ status: 'processed', processedAt: '2026-10-09T15:00:00.000Z', openOrders: 0 }), /já foi excluída/);

assert.equal(cleanDeletionReasonInput('   '), undefined);
assert.equal(cleanDeletionReasonInput(' a\n b '), 'a b');
assert.equal(cleanDeletionReasonInput('x'.repeat(500))?.length, 300);

// Links: sitemap, menu da conta, rodapé, privacidade.
assert.ok(SITEMAP_STATIC_PAGES.some((p) => p.path === '/excluir-conta'));
const menu = accountMenuSections({ loggedIn: false, whatsappHref: wa });
assert.ok(menu.flatMap((s) => s.items).some((i) => i.href === '/excluir-conta'));
const footer = readFileSync(join(__dirname, '../components/StorefrontChrome.tsx'), 'utf8');
assert.ok(footer.includes('href="/excluir-conta"'));
const page = readFileSync(join(__dirname, '../app/excluir-conta/page.tsx'), 'utf8');
assert.ok(page.includes('AccountDeletionRequest'));
assert.ok(page.includes('href="/privacidade"'));
assert.ok(!/@gmail|cnpj/i.test(page), 'sem contato inventado');

assert.equal(adminAccountDeletionProcessPath('a/b'), '/admin/account-deletion-requests/a%2Fb/process');

console.log('account-deletion.spec ok');
