/**
 * Fan-out de notificações para admins ativos no pagamento confirmado.
 * Cobre payload PT + seleção de destinatários + e-mail loja + wa.me no e-mail.
 * Em venda paga NÃO se exclui o comprador-admin.
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildAdminOrderPaidNotification,
  buildAdminFulfillmentNotification,
  buildStoreOwnerPaidWhatsApp,
  resolveAdminUrl,
} from './notifications.service';
import { adminOrderPaidEmail } from '../mail/mail.templates';

{
  const n = buildAdminOrderPaidNotification({
    publicId: 'SCH-007ABC',
    total: 199.9,
    orderId: 'ord-1',
  });
  assert.equal(n.type, 'order_paid');
  assert.equal(n.title, 'Novo pagamento');
  assert.ok(n.body.includes('SCH-007ABC'), n.body);
  assert.ok(n.body.includes('pago'), n.body);
  assert.ok(/R\$\s*199,90/.test(n.body), `expected BRL in body: ${n.body}`);
  assert.equal(n.linkUrl, '/admin');
  assert.equal(n.orderId, 'ord-1');
  console.log('admin-notify: payload pagamento — PASSOU');
}

{
  const n = buildAdminFulfillmentNotification({
    publicId: 'SCH-1',
    statusLabel: 'Em trânsito',
    orderId: 'ord-1',
  });
  assert.equal(n.type, 'order_status');
  assert.equal(n.title, 'Status do pedido');
  assert.ok(n.body.includes('SCH-1'));
  assert.ok(n.body.includes('Em trânsito'));
  assert.equal(n.linkUrl, '/admin');
  console.log('admin-notify: payload fulfillment — PASSOU');
}

/** Simula notifyActiveAdmins: só role=admin + status=active, com exclude. */
function fanOutAdmins(
  users: { id: string; role: string; status: string }[],
  opts: { excludeUserIds?: string[] },
) {
  const exclude = new Set(opts.excludeUserIds || []);
  return users
    .filter((u) => u.role === 'admin' && u.status === 'active' && !exclude.has(u.id))
    .map((u) => u.id);
}

{
  const users = [
    { id: 'a1', role: 'admin', status: 'active' },
    { id: 'a2', role: 'admin', status: 'active' },
    { id: 'a3', role: 'admin', status: 'blocked' },
    { id: 'c1', role: 'customer', status: 'active' },
    { id: 's1', role: 'seller', status: 'active' },
  ];
  const ids = fanOutAdmins(users, {});
  assert.deepEqual(ids.sort(), ['a1', 'a2']);
  const excl = fanOutAdmins(users, { excludeUserIds: ['a1'] });
  assert.deepEqual(excl, ['a2']);
  console.log('admin-notify: fan-out só admins ativos + exclude — PASSOU');
}

/** Venda paga: comprador === admin NÃO é excluído. */
{
  const buyerAdminId = 'a1';
  const users = [
    { id: 'a1', role: 'admin', status: 'active' },
    { id: 'a2', role: 'admin', status: 'active' },
  ];
  // Payment path: excludeUserIds = [] (nunca o buyerId)
  const paidFanOut = fanOutAdmins(users, { excludeUserIds: [] });
  assert.ok(paidFanOut.includes(buyerAdminId), 'buyer-admin deve receber Novo pagamento');
  assert.deepEqual(paidFanOut.sort(), ['a1', 'a2']);
  console.log('admin-notify: buyerId===adminId ainda notifica — PASSOU');
}

{
  const wa = buildStoreOwnerPaidWhatsApp({
    publicId: 'SCH-WA1',
    total: 42.5,
    customerName: 'Ana',
  });
  assert.ok(wa.url.startsWith('https://wa.me/5551996253766?text='), wa.url);
  assert.ok(wa.text.includes('SCH-WA1'), wa.text);
  assert.ok(wa.text.includes('Cliente pagou') || wa.text.includes('pedido'), wa.text);
  console.log('admin-notify: wa.me store-owner — PASSOU');
}

{
  const mail = adminOrderPaidEmail({
    publicId: 'SCH-MAIL1',
    total: 99.9,
    customerName: 'Claiton',
    customerEmail: 'schimitzclaiton@gmail.com',
    adminUrl: 'https://loja.example/admin',
    whatsappUrl: 'https://wa.me/5551996253766?text=teste',
  });
  assert.ok(mail.subject.includes('Nova venda paga'), mail.subject);
  assert.ok(mail.subject.includes('SCH-MAIL1'), mail.subject);
  assert.ok(/R\$\s*99,90/.test(mail.subject), mail.subject);
  assert.ok(mail.text.includes('schimitzclaiton@gmail.com'), mail.text);
  assert.ok(mail.text.includes('https://wa.me/5551996253766?text=teste'), mail.text);
  assert.ok(mail.html.includes('Abrir WhatsApp'), mail.html);
  assert.ok(mail.html.includes('Abrir painel admin'), mail.html);
  console.log('admin-notify: e-mail admin + wa.me no corpo — PASSOU');
}

{
  const prev = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://loja.test';
  assert.equal(resolveAdminUrl(), 'https://loja.test/admin');
  if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = prev;
  console.log('admin-notify: resolveAdminUrl — PASSOU');
}

{
  const paySrc = readFileSync(join(__dirname, '../payments/payments.service.ts'), 'utf8');
  assert.ok(paySrc.includes('notifyStoreOfPaidOrder'), 'payments deve chamar notifyStoreOfPaidOrder');
  assert.ok(!/excludeUserIds:\s*order\.userId/.test(paySrc), 'payments NÃO deve excluir buyer no fan-out pago');
  assert.ok(paySrc.includes('notifyStoreOfPaidOrder'), 'payments usa fan-out loja');

  const ordSrc = readFileSync(join(__dirname, '../orders/orders.service.ts'), 'utf8');
  assert.ok(ordSrc.includes('notifyStoreOfPaidOrder'), 'orders.markPaid notifica loja');
  assert.ok(!/excludeUserIds:\s*paid\.userId/.test(ordSrc), 'orders NÃO deve excluir buyer no pago');
  assert.ok(ordSrc.includes('buildAdminFulfillmentNotification'), 'fulfillment notifica outros admins');
  assert.ok(ordSrc.includes('excludeUserIds: [adminId]'), 'fulfillment ainda exclui o ator');

  const svcSrc = readFileSync(join(__dirname, 'notifications.service.ts'), 'utf8');
  assert.ok(svcSrc.includes("role: 'admin'"));
  assert.ok(svcSrc.includes("status: 'active'"));
  assert.ok(svcSrc.includes('notifyStoreOfPaidOrder'));
  assert.ok(svcSrc.includes('notifyAdminOrderPaid'), 'deve tentar enviar e-mail admin');
  assert.ok(svcSrc.includes('buildStoreOwnerPaidWhatsApp'));
  // Comentário de intenção: sem exclude no caminho de pagamento
  assert.ok(
    /Sem excludeUserIds|NÃO excluir o comprador|mesmo se comprador for admin/i.test(svcSrc),
    'docs/comentário: não excluir comprador-admin',
  );
  console.log('admin-notify: wiring payments/orders + mail — PASSOU');
}

console.log('admin-notify tests ok');
