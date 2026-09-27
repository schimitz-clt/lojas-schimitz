/**
 * COMANDO OMEGA — admin Financeiro API: RBAC metadata + confirmation/reason validation (no DB).
 */
import 'reflect-metadata';
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GUARDS_METADATA, PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { FinanceAdminController } from './finance-admin.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ConfirmedActionDto, RefundRequestDto, ReconcileDto } from './dto';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

assert.equal(Reflect.getMetadata(PATH_METADATA, FinanceAdminController), 'admin/finance');
const guards = Reflect.getMetadata(GUARDS_METADATA, FinanceAdminController) || [];
assert.ok(guards.includes(JwtAuthGuard) && guards.includes(RolesGuard), 'class-level JwtAuthGuard + RolesGuard');
assert.deepEqual(Reflect.getMetadata(ROLES_KEY, FinanceAdminController), ['admin'], 'ADMIN role required on every route');

const proto = FinanceAdminController.prototype as any;
const posts = Object.getOwnPropertyNames(proto).filter((k) => Reflect.getMetadata(METHOD_METADATA, proto[k]) === RequestMethod.POST);
assert.ok(posts.length >= 7, `POST actions: ${posts}`);
// tsx/esbuild does not emit design:paramtypes, so check the source: every POST handler's @Body()
// is typed with ConfirmedActionDto or a subclass (nest build/tsc emits the metadata for ValidationPipe).
const src = readFileSync(join(__dirname, 'finance-admin.controller.ts'), 'utf8');
const dtoSrc = readFileSync(join(__dirname, 'dto.ts'), 'utf8');
const confirmedTypes = new Set(['ConfirmedActionDto', ...Array.from(dtoSrc.matchAll(/export class (\w+) extends ConfirmedActionDto/g)).map((m) => m[1])]);
for (const k of posts) {
  const m = src.match(new RegExp(`async ${k}\\([^{]*?@Body\\(\\) \\w+: (\\w+)`));
  assert.ok(m && confirmedTypes.has(m[1]), `${k} must take a ConfirmedActionDto body (got ${m?.[1]})`);
}

const errs = (cls: any, body: any) => validateSync(plainToInstance(cls, body), { whitelist: true, forbidNonWhitelisted: true }).map((e) => e.property);
assert.deepEqual(errs(ConfirmedActionDto, { reason: 'motivo suficiente', confirm: true }), []);
assert.ok(errs(ConfirmedActionDto, { reason: 'curto', confirm: true }).includes('reason'));
assert.ok(errs(ConfirmedActionDto, { reason: 'motivo suficiente', confirm: false }).includes('confirm'));
assert.ok(errs(ConfirmedActionDto, { reason: 'motivo suficiente' }).includes('confirm'));
assert.ok(errs(RefundRequestDto, { reason: 'motivo suficiente', confirm: true, amount: 0 }).includes('amount'));
assert.ok(errs(RefundRequestDto, { reason: 'motivo suficiente', confirm: true, amount: 1.234 }).includes('amount'));
assert.deepEqual(errs(RefundRequestDto, { reason: 'motivo suficiente', confirm: true, amount: 10.5 }), []);
assert.ok(errs(ReconcileDto, { reason: 'motivo suficiente', confirm: true, scope: 'DAILY' }).includes('scope'));
assert.ok(errs(RefundRequestDto, { reason: 'motivo suficiente', confirm: true, cardNumber: '4111' }).includes('cardNumber'), 'unknown fields rejected');
console.log(`finance-admin.rbac.spec PASS (${posts.length} POST actions guarded + validated)`);
