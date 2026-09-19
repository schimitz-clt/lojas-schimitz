import 'reflect-metadata';
import assert from 'assert';
import { readFileSync } from 'fs';
import { createServer, request as httpRequest } from 'http';
import { join } from 'path';
import express, { json as expressJson } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException, Controller, Module, Post, Req, UnauthorizedException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { LoginDto } from '../modules/auth/dto';
import { applyHttpBodyParsers } from './http-body-parsers';

async function loginDtoOutcome(body: unknown): Promise<{ status: number; details: string[]; code: string }> {
  const dto = plainToInstance(LoginDto, body ?? {});
  const errors = await validate(dto);
  const details = errors.flatMap((e) => Object.values(e.constraints || {}));
  if (details.length) {
    return { status: 400, details, code: 'VALIDATION_ERROR' };
  }
  return { status: 401, details: [], code: 'INVALID_CREDENTIALS' };
}

const LOGIN_JSON = { email: 'schimitzclaiton@gmail.com', password: 'wrongpass1' };

function post(
  port: number,
  path: string,
  body: string,
  contentType: string,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          'content-type': contentType,
          'content-length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString('utf8') }),
        );
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function listen(app: express.Express): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('no listen port'));
        return;
      }
      resolve({
        port: addr.port,
        close: () =>
          new Promise((done, fail) => server.close((err) => (err ? fail(err) : done()))),
      });
    });
  });
}

async function expressEcho(apply: (app: express.Express) => void, contentType: string, payload: string) {
  const app = express();
  apply(app);
  app.post('/login', (req, res) => res.json(req.body ?? null));
  const { port, close } = await listen(app);
  try {
    return await post(port, '/login', payload, contentType);
  } finally {
    await close();
  }
}

@Controller('auth')
class LoginProbeController {
  @Post('login')
  async login(@Req() req: { body?: unknown }) {
    // tsx does not emit design:paramtypes; validate the same LoginDto the pipe uses.
    const outcome = await loginDtoOutcome(req.body);
    if (outcome.status === 400) {
      throw new BadRequestException({
        code: outcome.code,
        message: outcome.details[0],
        details: outcome.details,
      });
    }
    throw new UnauthorizedException({
      code: outcome.code,
      message: 'Credenciais inválidas',
    });
  }
}

@Module({ controllers: [LoginProbeController] })
class LoginProbeModule {}

async function main() {
  // --- Express middleware order (the live #60 failure mode) ---
  const broken = await expressEcho(
    (app) => {
      app.use(expressJson({ type: 'application/csp-report', limit: '32kb' }));
      app.use(expressJson({ type: 'application/reports+json', limit: '32kb' }));
    },
    'application/json',
    JSON.stringify(LOGIN_JSON),
  );
  const brokenBody = JSON.parse(broken.text);
  assert.equal(broken.status, 200);
  assert.equal(brokenBody.email, undefined, 'CSP-only parsers must leave application/json empty (repro)');
  assert.equal(brokenBody.password, undefined);

  const fixed = await expressEcho(
    (app) => applyHttpBodyParsers(app),
    'application/json',
    JSON.stringify(LOGIN_JSON),
  );
  const fixedBody = JSON.parse(fixed.text);
  assert.equal(fixed.status, 200);
  assert.equal(fixedBody.email, LOGIN_JSON.email);
  assert.equal(fixedBody.password, LOGIN_JSON.password);

  const csp = await expressEcho(
    (app) => applyHttpBodyParsers(app),
    'application/csp-report',
    JSON.stringify({ 'csp-report': { 'document-uri': 'https://lojasschimitz.com.br/' } }),
  );
  const cspBody = JSON.parse(csp.text);
  assert.equal(cspBody['csp-report']['document-uri'], 'https://lojasschimitz.com.br/');

  const reports = await expressEcho(
    (app) => applyHttpBodyParsers(app),
    'application/reports+json',
    JSON.stringify([{ type: 'csp-violation', body: { documentURL: 'https://lojasschimitz.com.br/checkout' } }]),
  );
  const reportsBody = JSON.parse(reports.text);
  assert.equal(reportsBody[0].type, 'csp-violation');

  const form = await expressEcho(
    (app) => applyHttpBodyParsers(app),
    'application/x-www-form-urlencoded',
    'email=cliente%40exemplo.com&password=wrongpass1',
  );
  const formBody = JSON.parse(form.text);
  assert.equal(formBody.email, 'cliente@exemplo.com');
  assert.equal(formBody.password, 'wrongpass1');

  // --- Slim Nest + ValidationPipe (login DTO, no DB) ---
  const app = await NestFactory.create<NestExpressApplication>(LoginProbeModule, {
    bodyParser: false,
    logger: false,
  });
  applyHttpBodyParsers(app);
  await app.listen(0, '127.0.0.1');
  const url = await app.getUrl();
  const port = Number(new URL(url).port);
  try {
    const okShape = await post(port, '/auth/login', JSON.stringify(LOGIN_JSON), 'application/json');
    assert.equal(okShape.status, 401, `expected 401 after parsed login DTO, got ${okShape.status} ${okShape.text}`);
    assert.equal(okShape.text.includes('email must be an email'), false, okShape.text);
    assert.equal(okShape.text.includes('password must be a string'), false, okShape.text);
    assert.ok(
      okShape.text.includes('INVALID_CREDENTIALS') || okShape.text.includes('Credenciais inválidas'),
      okShape.text,
    );

    const empty = await post(port, '/auth/login', '{}', 'application/json');
    assert.equal(empty.status, 400);
    assert.ok(empty.text.includes('email must be an email'), empty.text);
  } finally {
    await app.close();
  }

  // --- Source lock: main.ts must keep default JSON parser ---
  const mainTs = readFileSync(join(__dirname, '../main.ts'), 'utf8');
  assert.ok(mainTs.includes('bodyParser: false'));
  assert.ok(mainTs.includes('applyHttpBodyParsers'));
  assert.equal(mainTs.includes("type: 'application/csp-report'"), false);
  const helper = readFileSync(join(__dirname, 'http-body-parsers.ts'), 'utf8');
  assert.ok(helper.includes('expressJson({ limit:'));
  assert.ok(helper.includes('extended: true'));
  assert.ok(helper.includes('application/csp-report'));
  assert.ok(helper.includes('application/reports+json'));

  console.log('http-body-parsers regression tests ok');
}

void main();
