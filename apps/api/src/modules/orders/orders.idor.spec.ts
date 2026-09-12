/**
 * Orders IDOR/BOLA — customer A cannot read/cancel B's order.
 * Contract: cross-user → 404 ORDER_NOT_FOUND (not 403).
 * Source contract: list/get/cancel always scope by userId.
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NotFoundException } from '@nestjs/common';
import { denyIfNotOwner, OWNERSHIP_CODES } from '../../common/ownership';

function codeOf(e: NotFoundException) {
  const r = e.getResponse() as any;
  return typeof r === 'object' ? r.code : undefined;
}

function denyCrossUserOrder() {
  const d = denyIfNotOwner('user-a', 'user-b', OWNERSHIP_CODES.ORDER_NOT_FOUND, 'Pedido não encontrado');
  if (!d.ok) throw new NotFoundException({ message: d.message, code: d.code });
}

try {
  denyCrossUserOrder();
  assert.fail('expected throw');
} catch (e) {
  assert.ok(e instanceof NotFoundException);
  assert.equal(codeOf(e as NotFoundException), 'ORDER_NOT_FOUND');
}

const same = denyIfNotOwner('user-a', 'user-a', OWNERSHIP_CODES.ORDER_NOT_FOUND, 'Pedido não encontrado');
assert.equal(same.ok, true);

const svc = readFileSync(join(__dirname, 'orders.service.ts'), 'utf8');
assert.ok(svc.includes('where: { userId }') || svc.includes('where: { publicId, userId }'), 'list/get must scope userId');
assert.ok(svc.includes('where: { publicId, userId }'), 'getByPublicId/cancel must use publicId+userId');
assert.ok(svc.includes("code: 'ORDER_NOT_FOUND'") || svc.includes('ORDER_NOT_FOUND'), 'ORDER_NOT_FOUND code');

const ctrl = readFileSync(join(__dirname, 'orders.controller.ts'), 'utf8');
assert.ok(ctrl.includes('JwtAuthGuard'), 'orders require JWT');
assert.ok(ctrl.includes("CurrentUser('sub')"), 'orders use CurrentUser sub');
assert.ok(!ctrl.includes('RolesGuard'), 'customer orders must not use admin RolesGuard alone');

console.log('orders.idor contract ok');
