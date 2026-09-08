/**
 * Password reset E2E — Postgres LOCAL only (AuthService real + Nest DI).
 * Never railway.internal / produção. Does not print raw tokens.
 */
import assert from 'assert';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma.service';
import { AuthService } from './auth.service';
import { randomBytes, randomUUID } from 'crypto';
import * as argon2 from 'argon2';

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  if (/railway|rlwy|\.internal/i.test(url)) {
    throw new Error('RECUSADO: DATABASE_URL parece produção/Railway');
  }
  if (!/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error('RECUSADO: DATABASE_URL deve ser localhost/127.0.0.1');
  }
  console.log('DB_SAFE:', url.replace(/:[^:@]+@/, ':***@'));
}

async function main() {
  assertLocalDb();
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'sch004-access-secret-local-xxxx';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'sch004-refresh-secret-local-xxx';
  // Ensure SMTP off so we exercise persist + local log path (no external send)
  delete process.env.SMTP_HOST;
  delete process.env.MAIL_FROM;
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';

  const app: INestApplicationContext = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const auth = app.get(AuthService);

  const email = `reset-${randomUUID().slice(0, 8)}@lojas-schimitz.test`;
  const oldPass = 'OldPass123';
  const newPass = 'NewPass456';
  const passwordHash = await argon2.hash(oldPass);
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Reset Tester',
      passwordHash,
      role: 'customer',
      status: 'active',
    },
  });

  let refreshRowId: string | null = null;
  try {
    // Issue a session so we can assert invalidation
    const session = await auth.login({ email, password: oldPass }, '127.0.0.1');
    assert.ok(session.refreshToken);
    const refreshCount = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });
    assert.ok(refreshCount >= 1);

    // Unknown email still accepted (no enumeration)
    const ghost = await auth.forgotPassword(`missing-${randomUUID().slice(0, 6)}@example.com`, '127.0.0.1');
    assert.equal(ghost.accepted, true);

    // Real forgot — token persisted (hashed)
    const forgot = await auth.forgotPassword(email, '127.0.0.1');
    assert.equal(forgot.accepted, true);
    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    assert.equal(tokens.length, 1);
    assert.ok(tokens[0].expiresAt.getTime() > Date.now());
    assert.equal(tokens[0].tokenHash.length, 64); // sha256 hex

    // Craft known raw token for reset path (do not log it)
    const raw = randomBytes(32).toString('hex');
    const tokenHash = auth.hashResetToken(raw);
    await prisma.passwordResetToken.update({
      where: { id: tokens[0].id },
      data: { tokenHash },
    });

    // Bad token fails
    let bad = false;
    try {
      await auth.resetPassword('0'.repeat(40), newPass, '127.0.0.1');
    } catch {
      bad = true;
    }
    assert.equal(bad, true);

    // Good reset
    const reset = await auth.resetPassword(raw, newPass, '127.0.0.1');
    assert.equal(reset.reset, true);

    const used = await prisma.passwordResetToken.findUnique({ where: { id: tokens[0].id } });
    assert.ok(used?.usedAt);

    // Sessions revoked
    const stillActive = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });
    assert.equal(stillActive, 0);

    // Old password fails, new works
    let oldFailed = false;
    try {
      await auth.login({ email, password: oldPass }, '127.0.0.1');
    } catch {
      oldFailed = true;
    }
    assert.equal(oldFailed, true);
    const again = await auth.login({ email, password: newPass }, '127.0.0.1');
    assert.ok(again.accessToken);

    // Replay token fails
    let replay = false;
    try {
      await auth.resetPassword(raw, 'AnotherPass789', '127.0.0.1');
    } catch {
      replay = true;
    }
    assert.equal(replay, true);

    // Expired token
    const raw2 = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: auth.hashResetToken(raw2),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    let expired = false;
    try {
      await auth.resetPassword(raw2, 'ExpiredPass1', '127.0.0.1');
    } catch {
      expired = true;
    }
    assert.equal(expired, true);

    console.log('password-reset.db.spec PASS');
  } finally {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
