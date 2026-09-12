/**
 * PATCH /me — cannot escalate role/email/status/cashback via body.
 * getMe/updateMe always keyed by JWT sub (no userId path param).
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { filterMePatchKeys, ME_PATCH_ALLOWED_KEYS } from '../../common/ownership';

const escalate = filterMePatchKeys({
  name: 'Ok',
  role: 'admin',
  email: 'x@y.z',
  status: 'active',
  password: 'x',
  cashbackBalance: 1000,
});
assert.deepEqual(Object.keys(escalate.allowed).sort(), ['name']);
assert.ok(escalate.rejected.includes('role'));
assert.ok(escalate.rejected.includes('email'));
assert.ok(escalate.rejected.includes('status'));
assert.ok(escalate.rejected.includes('password'));
assert.ok(escalate.rejected.includes('cashbackBalance'));

const svc = readFileSync(join(__dirname, 'users.service.ts'), 'utf8');
assert.ok(svc.includes('dto.name'), 'updateMe uses dto.name');
assert.ok(svc.includes('dto.phone'), 'updateMe uses dto.phone');
assert.ok(!svc.includes('dto.role'), 'updateMe must not write role');
assert.ok(!svc.includes('dto.email'), 'updateMe must not write email');
assert.ok(!svc.includes('dto.status'), 'updateMe must not write status');
assert.ok(!svc.includes('dto.cashbackBalance'), 'updateMe must not write cashback from dto');
// data block only spreads name/phone from dto
assert.ok(svc.includes('...(dto.name !== undefined'), 'name whitelist spread');
assert.ok(svc.includes('...(dto.phone !== undefined'), 'phone whitelist spread');

const dto = readFileSync(join(__dirname, 'dto.ts'), 'utf8');
assert.ok(dto.includes('name?'));
assert.ok(dto.includes('phone?'));
assert.ok(!dto.includes('role'));
assert.ok(!dto.includes('email'));

const ctrl = readFileSync(join(__dirname, 'users.controller.ts'), 'utf8');
assert.ok(ctrl.includes('JwtAuthGuard'));
assert.ok(ctrl.includes("CurrentUser('sub')"));
assert.ok(!ctrl.includes('@Param'), 'me endpoints must not take foreign user id');

assert.deepEqual([...ME_PATCH_ALLOWED_KEYS].sort(), ['name', 'phone'].sort());

console.log('users.idor / me-patch contract ok');
