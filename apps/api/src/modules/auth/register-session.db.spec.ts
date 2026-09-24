/**
 * Register session + duplicate CPF/e-mail — Postgres LOCAL only.
 * New user gets the same tokens as login, including a refresh row.
 * With REFRESH_JSON_TOKEN_ENABLED=false, issueAuthSession still sets sch_refresh.
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, HttpException, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Response } from 'express';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma.service';
import { AuthService } from './auth.service';
import {
  REGISTER_CPF_EXISTS_CODE,
  REGISTER_CPF_EXISTS_MESSAGE,
  REGISTER_EMAIL_EXISTS_CODE,
  REGISTER_EMAIL_EXISTS_MESSAGE,
} from './register-public';
import { issueAuthSession } from './refresh-cookie';

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

function messageOf(error: unknown): string {
  if (!(error instanceof HttpException)) return '';
  const body = error.getResponse();
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: string | string[] }).message;
    return Array.isArray(message) ? String(message[0]) : String(message);
  }
  return '';
}

function codeOf(error: unknown): string {
  if (!(error instanceof HttpException)) return '';
  const body = error.getResponse();
  if (body && typeof body === 'object' && 'code' in body) return String((body as { code: string }).code);
  return '';
}

function mockRes() {
  const headers = new Map<string, string | string[]>();
  return {
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    setHeader(name: string, value: string | string[]) {
      headers.set(name.toLowerCase(), value);
    },
  };
}

async function main() {
  assertLocalDb();
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'sch004-access-secret-local-xxxx';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'sch004-refresh-secret-local-xxx';
  process.env.REFRESH_COOKIE_ENABLED = 'true';
  process.env.REFRESH_JSON_TOKEN_ENABLED = 'false';
  process.env.REFRESH_COOKIE_SAMESITE = 'lax';
  delete process.env.SMTP_HOST;
  delete process.env.MAIL_FROM;

  const app: INestApplicationContext = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const auth = app.get(AuthService);
  const tag = randomUUID().slice(0, 8);
  const freshEmail = `reg-${tag}-new@lojas-schimitz.test`;
  const takenEmail = `reg-${tag}-mail@lojas-schimitz.test`;
  const takenCpfEmail = `reg-${tag}-cpf@lojas-schimitz.test`;
  const emails = [freshEmail, takenEmail, takenCpfEmail, `reg-${tag}-other@lojas-schimitz.test`];
  const password = 'Senha1234';
  const freshCpf = '52998224725';
  const existingCpf = '11144477735';
  const otherCpf = '39053344705';

  try {
    await prisma.user.create({
      data: {
        email: takenEmail,
        name: 'E-mail já existe',
        passwordHash: 'not-used',
        role: 'customer',
        status: 'active',
        cpf: otherCpf,
        birthDate: new Date(Date.UTC(1991, 0, 2)),
      },
    });
    await prisma.user.create({
      data: {
        email: takenCpfEmail,
        name: 'CPF já existe',
        passwordHash: 'not-used',
        role: 'customer',
        status: 'active',
        cpf: existingCpf,
        birthDate: new Date(Date.UTC(1992, 1, 3)),
      },
    });

    const session = await auth.register(
      {
        email: freshEmail,
        password,
        name: 'Conta Nova',
        cpf: freshCpf,
        birthDate: '1990-05-15',
        phone: '51999990000',
      },
      '127.0.0.1',
    );
    assert.equal(session.user.email, freshEmail);
    assert.ok(session.accessToken, 'register returns an access token');
    assert.ok(session.refreshToken, 'register returns a refresh token for the cookie');
    const refreshRows = await prisma.refreshToken.count({
      where: { userId: session.user.id, revokedAt: null },
    });
    assert.equal(refreshRows, 1, 'register persists a refresh row like login');

    const refreshed = await auth.refresh({ refreshToken: session.refreshToken });
    assert.ok(refreshed.accessToken, 'the register refresh token rotates like login');

    const res = mockRes();
    const issued = issueAuthSession(res as unknown as Response, session);
    const setCookie = res.getHeader('set-cookie');
    const cookieText = Array.isArray(setCookie) ? setCookie.join('\n') : String(setCookie);
    assert.ok(cookieText.includes('sch_refresh='), cookieText);
    assert.ok(cookieText.includes('HttpOnly'), cookieText);
    assert.equal('refreshToken' in issued, false, 'REFRESH_JSON_TOKEN_ENABLED=false omits refresh JSON');
    assert.equal(issued.accessToken, session.accessToken);
    assert.ok(!JSON.stringify(issued).includes(session.refreshToken));

    const stored = await prisma.user.findUnique({ where: { email: freshEmail } });
    assert.equal(stored?.cpf, freshCpf);
    assert.equal(stored?.name, 'Conta Nova');

    await assert.rejects(
      () =>
        auth.register(
          {
            email: `reg-${tag}-other@lojas-schimitz.test`,
            password,
            name: 'Outro Nome',
            cpf: existingCpf,
            birthDate: '1990-05-15',
          },
          '127.0.0.2',
        ),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(error.getStatus(), 409);
        assert.equal(messageOf(error), REGISTER_CPF_EXISTS_MESSAGE);
        assert.equal(codeOf(error), REGISTER_CPF_EXISTS_CODE);
        return true;
      },
    );
    const cpfDup = await prisma.user.findUnique({
      where: { email: `reg-${tag}-other@lojas-schimitz.test` },
    });
    assert.equal(cpfDup, null, 'duplicate CPF does not create a user');

    await assert.rejects(
      () =>
        auth.register(
          {
            email: takenEmail,
            password,
            name: 'Outro Nome',
            cpf: '86288366757',
            birthDate: '1988-08-08',
          },
          '127.0.0.3',
        ),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(error.getStatus(), 409);
        assert.equal(messageOf(error), REGISTER_EMAIL_EXISTS_MESSAGE);
        assert.equal(codeOf(error), REGISTER_EMAIL_EXISTS_CODE);
        return true;
      },
    );

    await assert.rejects(
      () =>
        auth.register(
          {
            email: `reg-${tag}-badcpf@lojas-schimitz.test`,
            password,
            name: 'CPF Ruim',
            cpf: '111.111.111-11',
            birthDate: '1990-05-15',
          },
          '127.0.0.4',
        ),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.getStatus(), 400);
        assert.equal(messageOf(error), 'CPF inválido');
        return true;
      },
    );

    await assert.rejects(
      () =>
        auth.register(
          {
            email: `reg-${tag}-minor@lojas-schimitz.test`,
            password,
            name: 'Menor',
            cpf: '86288366757',
            birthDate: '2015-01-01',
          },
          '127.0.0.5',
        ),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.getStatus(), 400);
        assert.equal(messageOf(error), 'É preciso ter 18 anos ou mais para criar a conta.');
        return true;
      },
    );

    console.log('register-session.db.spec PASS');
  } finally {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    if (ids.length) {
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
