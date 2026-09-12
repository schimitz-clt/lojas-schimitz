/**
 * Addresses IDOR — customer A cannot update/delete B's address.
 * Contract: cross-user → 404 ADDRESS_NOT_FOUND.
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

function denyCrossUserAddress() {
  const d = denyIfNotOwner('user-a', 'user-b', OWNERSHIP_CODES.ADDRESS_NOT_FOUND, 'Endereço não encontrado');
  if (!d.ok) throw new NotFoundException({ message: d.message, code: d.code });
}

try {
  denyCrossUserAddress();
  assert.fail('expected throw');
} catch (e) {
  assert.ok(e instanceof NotFoundException);
  assert.equal(codeOf(e as NotFoundException), 'ADDRESS_NOT_FOUND');
}

const svc = readFileSync(join(__dirname, 'addresses.service.ts'), 'utf8');
assert.ok(svc.includes('where: { userId }'), 'list scopes userId');
assert.ok(svc.includes('where: { id, userId }'), 'update/remove must findFirst with id+userId');
assert.ok(svc.includes('ADDRESS_NOT_FOUND'), 'ADDRESS_NOT_FOUND code');
// Defense-in-depth: mutations should re-scope by userId (updateMany/deleteMany or where compound).
assert.ok(
  /updateMany\([\s\S]*userId/.test(svc) || /where:\s*\{\s*id,\s*userId\s*\}/.test(svc),
  'mutations must keep userId in ownership path',
);

const ctrl = readFileSync(join(__dirname, 'addresses.controller.ts'), 'utf8');
assert.ok(ctrl.includes('JwtAuthGuard'));
assert.ok(ctrl.includes("CurrentUser('sub')"));

console.log('addresses.idor contract ok');
