/**
 * Achado 7c — access JWT revogado no logout (Postgres LOCAL, HTTP real, app compilado como em produção).
 * Antes: após POST /auth/logout o mesmo access seguia válido até 15 min (GET /me → 200).
 * Agora: GET /me com o access antigo → 401; outra sessão do mesmo usuário continua válida.
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { bootHttpApp, compileApi } from '../finance/testing/compiled-app';

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  if (/railway|rlwy|\.internal/i.test(url) || !/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: DATABASE_URL não é local');
}

async function main() {
  assertLocalDb();
  Object.assign(process.env, {
    APP_ENV: 'development', NODE_ENV: 'development',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'logout-revoke-access-secret-xxxxxxxx',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'logout-revoke-refresh-secret-xxxxxxx',
    REFRESH_COOKIE_SECURE: 'false',
  });
  compileApi();
  const srv = await bootHttpApp();
  const prisma = new PrismaClient({ log: ['error'] });
  let ip = 1;
  const call = async (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) => {
    const r = await fetch(`${srv.base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.88.0.${ip++ % 250}`, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return r;
  };
  try {
    const email = `logout-revoke-${randomUUID().slice(0, 8)}@test.local`;
    const password = 'Logout-Revoke-Pass-123';
    const u = await prisma.user.create({ data: { email, passwordHash: await argon2.hash(password), name: 'Logout Teste', role: 'customer', status: 'active' } });
    const login = async () => {
      const r = await call('POST', '/auth/login', {}, { email, password });
      assert.equal(r.status, 201);
      const cookies = r.headers.getSetCookie().map((c) => c.split(';')[0]).filter((c) => /^sch_(access|refresh)=/.test(c));
      const access = decodeURIComponent(cookies.find((c) => c.startsWith('sch_access='))!.slice('sch_access='.length));
      return { cookie: cookies.join('; '), access };
    };
    const a = await login();
    const b = await login();
    const payload = JSON.parse(Buffer.from(a.access.split('.')[1], 'base64url').toString());
    assert.ok(typeof payload.jti === 'string' && payload.jti.length > 10, 'access leva jti');

    // Antes do logout: cookie e Bearer valem
    assert.equal((await call('GET', '/me', { cookie: a.cookie })).status, 200);
    assert.equal((await call('GET', '/me', { authorization: `Bearer ${a.access}` })).status, 200);

    const out = await call('POST', '/auth/logout', { cookie: a.cookie });
    assert.equal(out.status, 201);
    const row = await prisma.revokedAccessToken.findUnique({ where: { jti: payload.jti } });
    assert.ok(row && row.userId === u.id, 'jti na denylist');
    assert.ok(Math.abs(row!.expiresAt.getTime() - payload.exp * 1000) < 2000, 'expira junto com o access');

    // Depois do logout: o MESMO access (copiado antes) não vale mais — nem por cookie, nem por Bearer
    assert.equal((await call('GET', '/me', { cookie: `sch_access=${encodeURIComponent(a.access)}` })).status, 401);
    assert.equal((await call('GET', '/me', { authorization: `Bearer ${a.access}` })).status, 401);
    // Rotas com JWT opcional tratam como visitante (sem vazar a sessão)
    const cart = await call('GET', '/cart', { authorization: `Bearer ${a.access}` });
    assert.ok([200, 201].includes(cart.status), `cart ${cart.status}`);
    // O refresh da sessão encerrada também não vale
    assert.equal((await call('POST', '/auth/refresh', { cookie: a.cookie }, {})).status, 401);

    // Outra sessão (outro aparelho) segue funcionando
    assert.equal((await call('GET', '/me', { authorization: `Bearer ${b.access}` })).status, 200);

    // Logout repetido com o mesmo access é idempotente (sem erro)
    assert.equal((await call('POST', '/auth/logout', { authorization: `Bearer ${a.access}` })).status, 201);
    assert.equal(await prisma.revokedAccessToken.count({ where: { jti: payload.jti } }), 1);
    console.log('logout-revocation.db (7c) ok');
  } finally {
    await prisma.$disconnect();
    await srv.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
