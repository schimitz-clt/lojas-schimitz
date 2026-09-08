/**
 * Documenta contrato IDOR: cross-user → NotFound (não Forbidden).
 * Unit: codes/messages; DB coverage em admin-customers.db.spec + ownership em services.
 */
import assert from 'assert';
import { NotFoundException } from '@nestjs/common';

function denyCrossUserOrder() {
  throw new NotFoundException({ message: 'Pedido não encontrado', code: 'ORDER_NOT_FOUND' });
}
function denyCrossUserPayment() {
  throw new NotFoundException({ message: 'Pagamento não encontrado', code: 'PAYMENT_NOT_FOUND' });
}

function codeOf(e: NotFoundException) {
  const r = e.getResponse() as any;
  return typeof r === 'object' ? r.code : undefined;
}

try {
  denyCrossUserOrder();
  assert.fail('expected throw');
} catch (e) {
  assert.ok(e instanceof NotFoundException);
  assert.equal(codeOf(e as NotFoundException), 'ORDER_NOT_FOUND');
}

try {
  denyCrossUserPayment();
  assert.fail('expected throw');
} catch (e) {
  assert.ok(e instanceof NotFoundException);
  assert.equal(codeOf(e as NotFoundException), 'PAYMENT_NOT_FOUND');
}

console.log('payment.idor contract ok');
