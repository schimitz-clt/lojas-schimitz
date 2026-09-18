/**
 * Documenta contrato IDOR: cross-user → NotFound (não Forbidden).
 * Source locks: payments.service always 404 (never 403) on foreign order/payment.
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NotFoundException } from '@nestjs/common';
import { denyIfNotOwner, OWNERSHIP_CODES } from '../../common/ownership';

function denyCrossUserOrder() {
  const d = denyIfNotOwner('user-a', 'user-b', OWNERSHIP_CODES.ORDER_NOT_FOUND, 'Pedido não encontrado');
  if (!d.ok) throw new NotFoundException({ message: d.message, code: d.code });
}
function denyCrossUserPayment() {
  const d = denyIfNotOwner('user-a', 'user-b', OWNERSHIP_CODES.PAYMENT_NOT_FOUND, 'Pagamento não encontrado');
  if (!d.ok) throw new NotFoundException({ message: d.message, code: d.code });
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

const samePay = denyIfNotOwner('user-a', 'user-a', OWNERSHIP_CODES.PAYMENT_NOT_FOUND, 'Pagamento não encontrado');
assert.equal(samePay.ok, true);

const svc = readFileSync(join(__dirname, 'payments.service.ts'), 'utf8');
assert.ok(svc.includes("code: 'ORDER_NOT_FOUND'"), 'createIntent foreign order → ORDER_NOT_FOUND');
assert.ok(svc.includes("code: 'PAYMENT_NOT_FOUND'"), 'getPayment foreign → PAYMENT_NOT_FOUND');
assert.ok(svc.includes('order.userId !== userId') || svc.includes('payment.order.userId !== userId'), 'ownership compare');
assert.ok(!/throw new ForbiddenException/.test(svc), 'payments must not 403 on IDOR (enumerates existence)');
assert.ok(svc.includes('where: { id: orderId, userId }'), 'getByOrder scopes userId');

const ctrl = readFileSync(join(__dirname, 'payments.controller.ts'), 'utf8');
assert.ok(ctrl.includes('JwtAuthGuard'), 'payment GETs/intents require JWT');
assert.ok(ctrl.includes("CurrentUser('sub')"), 'payments use CurrentUser sub');

console.log('payment.idor contract ok');
