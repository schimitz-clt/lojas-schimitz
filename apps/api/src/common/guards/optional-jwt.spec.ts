/**
 * Optional JWT — blocked / missing users stay guest (F7).
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveOptionalAccessUser } from './optional-jwt';

async function main() {
  const guest = await resolveOptionalAccessUser({
    token: '',
    verify: async () => ({ sub: 'x' }),
    lookupUser: async () => ({ id: 'x', email: 'a@b.c', role: 'customer', status: 'active' }),
  });
  assert.equal(guest, null);

  const active = await resolveOptionalAccessUser({
    token: 'tok',
    verify: async () => ({ sub: 'u1', role: 'admin' }),
    lookupUser: async () => ({ id: 'u1', email: 'a@b.c', role: 'customer', status: 'active' }),
  });
  assert.equal(active?.sub, 'u1');
  assert.equal(active?.role, 'customer', 'DB role wins over JWT claim');
  assert.equal(active?.status, 'active');

  const blocked = await resolveOptionalAccessUser({
    token: 'tok',
    verify: async () => ({ sub: 'u2' }),
    lookupUser: async () => ({ id: 'u2', email: 'b@b.c', role: 'customer', status: 'blocked' }),
  });
  assert.equal(blocked, null, 'blocked user must not attach to cart/chat');

  const missing = await resolveOptionalAccessUser({
    token: 'tok',
    verify: async () => ({ sub: 'gone' }),
    lookupUser: async () => null,
  });
  assert.equal(missing, null);

  const badJwt = await resolveOptionalAccessUser({
    token: 'tok',
    verify: async () => {
      throw new Error('invalid');
    },
    lookupUser: async () => ({ id: 'u', email: 'a@b.c', role: 'customer', status: 'active' }),
  });
  assert.equal(badJwt, null);

  const guardSrc = readFileSync(join(__dirname, 'optional-jwt.guard.ts'), 'utf8');
  assert.ok(guardSrc.includes('resolveOptionalAccessUser'));
  assert.ok(guardSrc.includes('prisma.user.findUnique'));
  assert.ok(guardSrc.includes("status: true"));

  const jwtGuard = readFileSync(join(__dirname, 'jwt-auth.guard.ts'), 'utf8');
  assert.ok(jwtGuard.includes("user.status !== 'active'"));

  console.log('optional-jwt unit tests ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
