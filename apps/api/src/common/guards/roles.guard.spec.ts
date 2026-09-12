/**
 * Admin authz — RolesGuard requires role listed in @Roles metadata.
 * Admin controller uses @Roles('admin') + JwtAuthGuard.
 */
import assert from 'assert';
import { ForbiddenException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isAdminRole } from '../ownership';

assert.equal(isAdminRole('admin'), true);
assert.equal(isAdminRole('customer'), false);

function simulateRolesGuard(required: string[] | undefined, user: { role?: string } | null) {
  if (!required || required.length === 0) return true;
  if (!user || !required.includes(user.role || '')) {
    throw new ForbiddenException('Sem permissão');
  }
  return true;
}

assert.equal(simulateRolesGuard(['admin'], { role: 'admin' }), true);

try {
  simulateRolesGuard(['admin'], { role: 'customer' });
  assert.fail('expected Forbidden');
} catch (e) {
  assert.ok(e instanceof ForbiddenException);
}

try {
  simulateRolesGuard(['admin'], null);
  assert.fail('expected Forbidden');
} catch (e) {
  assert.ok(e instanceof ForbiddenException);
}

try {
  simulateRolesGuard(['admin'], { role: 'seller' });
  assert.fail('expected Forbidden');
} catch (e) {
  assert.ok(e instanceof ForbiddenException);
}

const guardSrc = readFileSync(join(__dirname, 'roles.guard.ts'), 'utf8');
assert.ok(guardSrc.includes('ForbiddenException'));
assert.ok(guardSrc.includes('roles.includes(user.role)'));

const adminCtrl = readFileSync(
  join(__dirname, '../../modules/admin/admin.controller.ts'),
  'utf8',
);
assert.ok(adminCtrl.includes('JwtAuthGuard'));
assert.ok(adminCtrl.includes('RolesGuard'));
assert.ok(adminCtrl.includes("Roles('admin')"));

const adminPay = readFileSync(
  join(__dirname, '../../modules/payments/admin-payments.controller.ts'),
  'utf8',
);
assert.ok(adminPay.includes('RolesGuard'));

console.log('roles.guard admin authz ok');
