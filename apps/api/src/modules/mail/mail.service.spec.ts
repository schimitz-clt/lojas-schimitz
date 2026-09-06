import assert from 'assert';
import {
  adminOrderPaidEmail,
  orderDeliveredEmail,
  orderPaidEmail,
  orderReadyForPickupEmail,
  orderShippedEmail,
} from './mail.templates';

const paid = orderPaidEmail({ publicId: 'SCH-1', total: 10, customerName: 'Ana' });
assert.ok(paid.subject.includes('Pedido pago'));
assert.ok(paid.text.includes('SCH-1'));
assert.ok(paid.html.includes('Ana'));

const ready = orderReadyForPickupEmail({ publicId: 'SCH-3', total: 30 });
assert.ok(ready.subject.includes('Pronto para coleta'));
assert.ok(ready.text.includes('SCH-3'));

const shipped = orderShippedEmail({ publicId: 'SCH-2', total: 20 });
assert.ok(shipped.subject.includes('Saiu para entrega'));
assert.ok(shipped.text.includes('SCH-2'));

const delivered = orderDeliveredEmail({ publicId: 'SCH-4', total: 40 });
assert.ok(delivered.subject.includes('entregue'));

const adminPaid = adminOrderPaidEmail({
  publicId: 'SCH-9',
  total: 150,
  customerName: 'Lucas',
  customerEmail: 'schimitzclaiton@gmail.com',
  adminUrl: 'https://example.com/admin',
  whatsappUrl: 'https://wa.me/5551996253766?text=Nova%20venda',
});
assert.ok(adminPaid.subject.includes('Nova venda paga'));
assert.ok(adminPaid.subject.includes('SCH-9'));
assert.ok(adminPaid.text.includes('schimitzclaiton@gmail.com'));
assert.ok(adminPaid.html.includes('wa.me/5551996253766'));
assert.ok(adminPaid.html.includes('/admin'));

console.log('mail.service tests ok');
