import assert from 'assert';
import {
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

console.log('mail.service tests ok');
