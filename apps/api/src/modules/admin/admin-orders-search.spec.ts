/**
 * Admin order search — query behaviour + authz source locks.
 * Single store: no cross-tenant scope; q never widens beyond OR fields + take cap.
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ADMIN_ORDER_LIST_TAKE,
  ADMIN_ORDER_SEARCH_TAKE_MAX,
  buildAdminOrderWhere,
  clampOrderSearchTake,
  isPublicIdLike,
  resolveAdminOrdersTake,
  shouldServerOrderSearch,
} from './admin-orders-search';

assert.equal(isPublicIdLike('SCH-ABC'), true);
assert.equal(isPublicIdLike('sch-xyz'), true);
assert.equal(isPublicIdLike('SCH'), true);
assert.equal(isPublicIdLike('email@x.com'), false);
assert.equal(isPublicIdLike('ab'), false);

assert.equal(shouldServerOrderSearch(undefined), false);
assert.equal(shouldServerOrderSearch('  '), false);
assert.equal(shouldServerOrderSearch('ab'), false);
assert.equal(shouldServerOrderSearch('abc'), true);
assert.equal(shouldServerOrderSearch('SCH'), true);
assert.equal(shouldServerOrderSearch('SCH-1'), true);
assert.equal(shouldServerOrderSearch('  Ana  '), true);

assert.equal(clampOrderSearchTake(undefined), 50);
assert.equal(clampOrderSearchTake(0), 50);
assert.equal(clampOrderSearchTake(10), 10);
assert.equal(clampOrderSearchTake(999), ADMIN_ORDER_SEARCH_TAKE_MAX);
assert.equal(clampOrderSearchTake(3.9), 3);

assert.equal(resolveAdminOrdersTake(undefined), ADMIN_ORDER_LIST_TAKE);
assert.equal(resolveAdminOrdersTake('ab'), ADMIN_ORDER_LIST_TAKE);
assert.equal(resolveAdminOrdersTake('SCH-X'), 50);
assert.equal(resolveAdminOrdersTake('ana@loja.com', 999), ADMIN_ORDER_SEARCH_TAKE_MAX);

const empty = buildAdminOrderWhere(undefined);
assert.deepEqual(empty, {});
assert.ok(!('OR' in empty));

const short = buildAdminOrderWhere('ab');
assert.deepEqual(short, {});

const withStatus = buildAdminOrderWhere(undefined, { status: 'paid' as any });
assert.equal(withStatus.status, 'paid');
assert.ok(!withStatus.OR);

const searched = buildAdminOrderWhere('Ana', { status: 'paid' as any });
assert.equal(searched.status, 'paid');
assert.ok(Array.isArray(searched.OR));
assert.equal((searched.OR as any[]).length, 3);

const sch = buildAdminOrderWhere('SCH-ABC');
assert.ok(Array.isArray(sch.OR));
const pub = (sch.OR as any[]).find((x) => x.publicId);
assert.ok(pub?.publicId?.startsWith);
assert.equal(pub.publicId.startsWith, 'SCH-ABC');

const uuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const byId = buildAdminOrderWhere(uuid);
assert.ok((byId.OR as any[]).some((x) => x.id === uuid));

// Authz + endpoint contracts (source locks)
const ctrl = readFileSync(join(__dirname, 'admin.controller.ts'), 'utf8');
assert.ok(ctrl.includes("Roles('admin')"), 'admin-only Roles');
assert.ok(ctrl.includes('JwtAuthGuard') && ctrl.includes('RolesGuard'), 'guards');
assert.ok(ctrl.includes("@Get('orders')"), 'GET orders');
assert.ok(ctrl.includes('Throttle'), 'rate-limited orders list');
assert.ok(ctrl.includes('buildAdminOrderWhere'), 'uses search where builder');
assert.ok(ctrl.includes('resolveAdminOrdersTake'), 'uses take resolver');
assert.ok(!ctrl.includes('take: 10000'), 'no unbounded dump');
assert.ok(!ctrl.includes('take: 1000'), 'no large dump');

const dto = readFileSync(join(__dirname, 'dto.ts'), 'utf8');
assert.ok(dto.includes('class AdminOrdersQueryDto'));
assert.ok(/AdminOrdersQueryDto[\s\S]*q\?:/.test(dto), 'q on DTO');
assert.ok(/AdminOrdersQueryDto[\s\S]*@MaxLength\(120\)/.test(dto), 'q max length');

console.log('admin-orders-search unit + authz ok');
