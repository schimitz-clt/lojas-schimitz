/**
 * H4 e2e: a real Nest HTTP app (AllExceptionsFilter via APP_FILTER, request-id middleware,
 * real SecurityController) on 127.0.0.1 — asserts what lands in the logs for 5xx / 4xx / client errors.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Controller, Get, HttpException, Module, NotFoundException, Param } from '@nestjs/common';
import { APP_FILTER, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AddressInfo } from 'net';
import { applyHttpBodyParsers } from '../http-body-parsers';
import { requestIdMiddleware } from '../request-id';
import { opsSignals } from '../sliding-window';
import { AllExceptionsFilter } from './http-exception.filter';
import { SecurityController } from '../../modules/security/security.controller';
import { OpsAlertsModule } from '../../modules/ops-alerts/ops-alerts.module';
import { MailModule } from '../../modules/mail/mail.module';

@Controller('boom')
class BoomController {
  @Get('db/:id')
  db(@Param('id') id: string) {
    const e = new Error(`connect failed postgresql://u:pw123@db:5432/x for cliente@mail.com id=${id}`);
    (e as Error & { code?: string }).code = 'P1001';
    throw e;
  }
  @Get('http500')
  h500() {
    throw new HttpException('upstream exploded', 502);
  }
  @Get('notfound')
  nf() {
    throw new NotFoundException('nada');
  }
}

@Module({
  imports: [MailModule, OpsAlertsModule],
  controllers: [BoomController, SecurityController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
class TestModule {}

async function main() {
  process.env.APP_ENV = 'production';
  process.env.NODE_ENV = 'production';
  opsSignals.reset();
  const app = await NestFactory.create<NestExpressApplication>(TestModule, { bodyParser: false, logger: false });
  app.use(requestIdMiddleware);
  applyHttpBodyParsers(app);
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  const port = (app.getHttpServer().address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}/api/v1`;

  const errors: string[] = [];
  const warns: string[] = [];
  const oe = console.error;
  const ow = console.warn;
  console.error = (l: unknown) => errors.push(String(l));
  console.warn = (l: unknown) => warns.push(String(l));
  try {
    // 1) unknown 500 → generic client body, one HTTP_5XX line with context, masked
    const r1 = await fetch(`${base}/boom/db/cm123?email=cliente@mail.com&token=abc`, { headers: { 'x-request-id': 'req-e2e-1' } });
    assert.equal(r1.status, 500);
    assert.equal(r1.headers.get('x-request-id'), 'req-e2e-1');
    const b1 = (await r1.json()) as { error: { message: string }; meta: { requestId: string } };
    assert.equal(b1.error.message, 'Erro interno');
    assert.equal(b1.meta.requestId, 'req-e2e-1');
    const l1 = errors.map((l) => JSON.parse(l)).find((j) => j.msg === 'HTTP_5XX' && j.requestId === 'req-e2e-1');
    assert.ok(l1, `no HTTP_5XX line: ${errors.join('\n')}`);
    assert.equal(l1.level, 'error');
    assert.equal(l1.status, 500);
    assert.equal(l1.method, 'GET');
    assert.equal(l1.path, '/api/v1/boom/db/cm123');
    assert.equal(l1.route, '/api/v1/boom/db/:id');
    assert.equal(l1.errorCode, 'P1001');
    assert.equal(l1.errorName, 'Error');
    assert.ok(typeof l1.stack === 'string' && l1.stack.includes('BoomController'), 'stack present');
    const raw1 = JSON.stringify(l1);
    for (const leak of ['pw123', 'cliente@mail.com', 'token=abc', 'email=']) assert.equal(raw1.includes(leak), false, `leak ${leak}`);

    // 2) HttpException 5xx → logged too; request id minted when absent
    const r2 = await fetch(`${base}/boom/http500`);
    assert.equal(r2.status, 502);
    const rid2 = r2.headers.get('x-request-id')!;
    assert.match(rid2, /^[0-9a-f-]{36}$/);
    const l2 = errors.map((l) => JSON.parse(l)).find((j) => j.msg === 'HTTP_5XX' && j.requestId === rid2);
    assert.ok(l2);
    assert.equal(l2.status, 502);
    assert.equal(l2.message, 'upstream exploded');

    // 3) 4xx → NOT logged as HTTP_5XX
    const before = errors.length;
    const r3 = await fetch(`${base}/boom/notfound`);
    assert.equal(r3.status, 404);
    assert.equal(errors.length, before);

    // 4) success-path unknown route still gets a request id header
    const r4 = await fetch(`${base}/nope`);
    assert.ok(r4.headers.get('x-request-id'));

    // 5) burst counter counted the two 5xx only
    assert.equal(opsSignals.count('http_5xx', 60_000), 2);

    // 6) client error collector → 204 + sanitized WEB_CLIENT_ERROR line
    const r6 = await fetch(`${base}/security/client-error`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'onerror', message: 'x is undefined for joao@x.com', page: 'https://lojasschimitz.com.br/checkout?token=T0K' }),
    });
    assert.equal(r6.status, 204);
    const l6 = warns.map((l) => { try { return JSON.parse(l); } catch { return {}; } }).find((j) => j.msg === 'WEB_CLIENT_ERROR');
    assert.ok(l6, warns.join('\n'));
    assert.equal(l6.page, '/checkout');
    assert.equal(JSON.stringify(l6).includes('joao@x.com'), false);
    assert.equal(JSON.stringify(l6).includes('T0K'), false);
  } finally {
    console.error = oe;
    console.warn = ow;
    await app.close();
    opsSignals.reset();
  }
  console.log('error-logging.e2e.spec OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
