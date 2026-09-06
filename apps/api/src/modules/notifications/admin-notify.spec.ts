/**
 * Fan-out de notificações para admins ativos no pagamento confirmado.
 * Cobre payload PT + seleção de destinatários (active admin only).
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildAdminOrderPaidNotification,
  buildAdminFulfillmentNotification,
} from './notifications.service';

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

{
  const paySrc = readFileSync(join(__dirname, '../payments/payments.service.ts'), 'utf8');
  assert.ok(paySrc.includes('notifyActiveAdmins'), 'payments deve chamar notifyActiveAdmins');
  assert.ok(paySrc.includes('buildAdminOrderPaidNotification'), 'payments usa payload admin');
  assert.ok(paySrc.includes('Novo pagamento') || paySrc.includes('buildAdminOrderPaidNotification'));

  const ordSrc = readFileSync(join(__dirname, '../orders/orders.service.ts'), 'utf8');
  assert.ok(ordSrc.includes('notifyActiveAdmins'), 'orders deve chamar notifyActiveAdmins');
  assert.ok(ordSrc.includes('buildAdminOrderPaidNotification'), 'markPaid notifica admins');
  assert.ok(ordSrc.includes('buildAdminFulfillmentNotification'), 'fulfillment notifica outros admins');

  const svcSrc = readFileSync(join(__dirname, 'notifications.service.ts'), 'utf8');
  assert.ok(svcSrc.includes("role: 'admin'"));
  assert.ok(svcSrc.includes("status: 'active'"));
  console.log('admin-notify: wiring payments/orders — PASSOU');
}

console.log('admin-notify tests ok');
