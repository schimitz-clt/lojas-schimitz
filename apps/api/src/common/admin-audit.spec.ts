/**
 * Auditoria de ações admin: saneamento, registro e interceptor (sem banco).
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { of, throwError, lastValueFrom } from 'rxjs';
import {
  buildAdminAuditRecord,
  entityFromPath,
  isMutatingMethod,
  normalizeAuditPath,
  sanitizeAuditValue,
} from './admin-audit';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import {
  AUDIT_LOG_MAX_TAKE,
  buildAuditLogWhere,
  clampAuditSkip,
  clampAuditTake,
} from '../modules/admin/admin-audit-query';

async function main() {
  // --- saneamento
  const s: any = sanitizeAuditValue({
    price: 19.9,
    password: 'x',
    refreshToken: 'abc',
    cpf: '123',
    csv: 'a;b\n1;2',
    name: 'N'.repeat(500),
    items: Array.from({ length: 50 }, (_, i) => i),
  });
  assert.equal(s.price, 19.9);
  assert.equal(s.password, '[omitido]');
  assert.equal(s.refreshToken, '[omitido]');
  assert.equal(s.cpf, '[omitido]');
  assert.match(s.csv, /^\[\d+ caracteres\]$/);
  assert.ok(s.name.length < 260);
  assert.equal(s.items.length, 21);

  assert.equal(isMutatingMethod('GET'), false);
  assert.equal(isMutatingMethod('patch'), true);
  assert.equal(normalizeAuditPath(undefined, '/api/v1/admin/products/3f2b1c9e-1111-4222-8333-444455556666?x=1'), '/api/v1/admin/products/:id');
  assert.equal(entityFromPath('/api/v1/admin/products/:id'), 'products');

  // --- registro
  const req: any = {
    method: 'PATCH',
    route: { path: '/api/v1/admin/products/:id' },
    params: { id: 'p1' },
    body: { price: 10, stock: 3, password: 'segredo' },
    ip: '1.2.3.4',
    requestId: 'rid',
    headers: { 'user-agent': 'UA' },
    user: { sub: 'admin1', role: 'admin' },
  };
  const rec = buildAdminAuditRecord(req, { ok: true })!;
  assert.equal(rec.action, 'admin.http.PATCH /api/v1/admin/products/:id');
  assert.equal(rec.actorId, 'admin1');
  assert.equal(rec.entity, 'products');
  assert.equal(rec.entityId, 'p1');
  assert.equal((rec.meta.body as any).price, 10);
  assert.equal((rec.meta.body as any).password, '[omitido]');
  assert.ok(!JSON.stringify(rec).includes('segredo'));
  assert.equal(buildAdminAuditRecord({ ...req, method: 'GET' }, { ok: true }), null);
  const bad = buildAdminAuditRecord(req, { ok: false, status: 400 })!;
  assert.equal(bad.meta.outcome, 'error');
  assert.equal(bad.meta.status, 400);

  // --- interceptor
  const calls: any[] = [];
  const audit: any = { log: async (a: string, o: any) => void calls.push({ a, o }) };
  const itc = new AdminAuditInterceptor(audit);
  const ctx: any = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) };
  const out = await lastValueFrom(itc.intercept(ctx, { handle: () => of({ ok: 1 }) }));
  assert.deepEqual(out, { ok: 1 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].o.actorId, 'admin1');

  await assert.rejects(
    lastValueFrom(itc.intercept(ctx, { handle: () => throwError(() => Object.assign(new Error('x'), { status: 409 })) })),
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[1].o.meta.status, 409);

  // GET não gera registro
  const getCtx: any = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => ({ ...req, method: 'GET' }) }) };
  await lastValueFrom(itc.intercept(getCtx, { handle: () => of(1) }));
  assert.equal(calls.length, 2);

  // falha do audit nunca derruba a requisição
  const boom: any = { log: async () => { throw new Error('db down'); } };
  const itc2 = new AdminAuditInterceptor(boom);
  assert.deepEqual(await lastValueFrom(itc2.intercept(ctx, { handle: () => of('fine') })), 'fine');
  const boomSync: any = { log: () => { throw new Error('sync'); } };
  const itc3 = new AdminAuditInterceptor(boomSync);
  assert.equal(await lastValueFrom(itc3.intercept(ctx, { handle: () => of('fine') })), 'fine');

  // --- consulta
  assert.equal(clampAuditTake(undefined), 50);
  assert.equal(clampAuditTake(99999), AUDIT_LOG_MAX_TAKE);
  assert.equal(clampAuditSkip(-3), 0);
  const w: any = buildAuditLogWhere({ actorId: 'a', entity: 'products', action: 'PATCH', from: '2026-10-01', to: 'lixo' });
  assert.equal(w.actorId, 'a');
  assert.equal(w.entity, 'products');
  assert.deepEqual(w.action, { contains: 'PATCH', mode: 'insensitive' });
  assert.ok(w.createdAt.gte instanceof Date);
  assert.equal(w.createdAt.lte, undefined);

  // --- travas de código-fonte: interceptor aplicado e endpoint protegido por admin
  const dir = join(__dirname, '..', 'modules');
  const ctrl = readFileSync(join(dir, 'admin', 'admin.controller.ts'), 'utf8');
  assert.match(ctrl, /@Roles\('admin'\)/);
  assert.match(ctrl, /@UseInterceptors\(AdminAuditInterceptor\)\s*\n@Roles\('admin'\)/);
  assert.match(ctrl, /@Get\('audit-log'\)/);
  for (const f of ['payments/admin-payments.controller.ts', 'push/admin-push.controller.ts', 'account-deletion/account-deletion.controller.ts']) {
    assert.match(readFileSync(join(dir, f), 'utf8'), /@UseInterceptors\(AdminAuditInterceptor\)/, f);
  }
  console.log('admin-audit unit tests ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
