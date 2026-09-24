/**
 * POST /auth/register abre sessão no sucesso e distingue CPF e e-mail já usados.
 * O dono pediu clareza no cadastro (não a resposta genérica sem token).
 * CPF inválido e menor de 18 anos continuam 400 — não passam por este conflito.
 */
import assert from 'assert';
import { ConflictException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CPF_ALREADY_REGISTERED_CODE,
  CPF_ALREADY_REGISTERED_MESSAGE,
  EMAIL_ALREADY_REGISTERED_CODE,
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  assertRegisterAvailable,
  conflictFromUniqueTarget,
} from './register-public';

function conflictOf(run: () => void): { message: string; code: string; status: number } {
  try {
    run();
  } catch (error) {
    assert.ok(error instanceof ConflictException, 'colisão é ConflictException');
    const body = error.getResponse() as { message?: string; code?: string };
    return {
      message: String(body.message || ''),
      code: String(body.code || ''),
      status: error.getStatus(),
    };
  }
  assert.fail('esperava conflito');
}

assert.equal(EMAIL_ALREADY_REGISTERED_MESSAGE, 'Este e-mail já possui conta. Faça login.');
assert.equal(CPF_ALREADY_REGISTERED_MESSAGE, 'Este CPF já possui conta. Entre ou use outro CPF.');
assert.notEqual(EMAIL_ALREADY_REGISTERED_MESSAGE, CPF_ALREADY_REGISTERED_MESSAGE);

assert.doesNotThrow(() => assertRegisterAvailable(false, false));

const emailHit = conflictOf(() => assertRegisterAvailable(true, false));
assert.equal(emailHit.status, 409);
assert.equal(emailHit.message, EMAIL_ALREADY_REGISTERED_MESSAGE);
assert.equal(emailHit.code, EMAIL_ALREADY_REGISTERED_CODE);

const bothHit = conflictOf(() => assertRegisterAvailable(true, true));
assert.equal(bothHit.message, EMAIL_ALREADY_REGISTERED_MESSAGE, 'e-mail tem precedência');
assert.equal(bothHit.code, EMAIL_ALREADY_REGISTERED_CODE);

const cpfHit = conflictOf(() => assertRegisterAvailable(false, true));
assert.equal(cpfHit.status, 409);
assert.equal(cpfHit.message, CPF_ALREADY_REGISTERED_MESSAGE);
assert.equal(cpfHit.code, CPF_ALREADY_REGISTERED_CODE);

const raceCpf = conflictOf(() => conflictFromUniqueTarget(['cpf']));
assert.equal(raceCpf.code, CPF_ALREADY_REGISTERED_CODE);
const raceNamed = conflictOf(() => conflictFromUniqueTarget('User_cpf_key'));
assert.equal(raceNamed.code, CPF_ALREADY_REGISTERED_CODE);
const raceEmail = conflictOf(() => conflictFromUniqueTarget(['email']));
assert.equal(raceEmail.code, EMAIL_ALREADY_REGISTERED_CODE);
const raceUnknown = conflictOf(() => conflictFromUniqueTarget(undefined));
assert.equal(raceUnknown.code, EMAIL_ALREADY_REGISTERED_CODE);

const svc = readFileSync(join(__dirname, 'auth.service.ts'), 'utf8');
const registerFn = svc.slice(svc.indexOf('async register('), svc.indexOf('private async notifyWelcome'));
assert.ok(registerFn.includes('async register('), 'register action present');
assert.ok(registerFn.includes('assertRegisterAvailable'), 'colisão passa pelo conflito distinto');
assert.ok(registerFn.includes('conflictFromUniqueTarget'), 'corrida P2002 também conflita');
assert.ok(registerFn.includes('return this.issue('), 'sucesso emite a sessão do login');
assert.ok(!registerFn.includes('registerAcceptedResult'), 'sucesso real não devolve accepted sem token');
assert.ok(!registerFn.includes('accepted: true'), 'cadastro não finge sucesso genérico');
assert.ok(
  registerFn.indexOf('argon2.hash(dto.password)') < registerFn.indexOf('findUnique'),
  'hash da senha acontece antes da consulta',
);
assert.ok(registerFn.includes('throw new BadRequestException(invalidCpf)'), 'CPF inválido segue 400');
assert.ok(registerFn.includes('throw new BadRequestException(invalidBirth)'), 'menor de 18 segue 400');
assert.ok(registerFn.includes('where: { cpf }'), 'CPF duplicado é consultado');

const ctrl = readFileSync(join(__dirname, 'auth.controller.ts'), 'utf8');
const registerBlock = ctrl.slice(ctrl.indexOf("@Post('register')"), ctrl.indexOf("@Post('login')"));
assert.ok(registerBlock.includes('issueAuthSession'), 'register grava o cookie como o login');
assert.ok(registerBlock.includes('mergeGuest'), 'carrinho guest segue o mesmo caminho do login');
assert.ok(registerBlock.includes('@Res({ passthrough: true })'), 'Set-Cookie precisa do response');
assert.ok(registerBlock.includes(EMAIL_ALREADY_REGISTERED_MESSAGE), 'swagger cita o e-mail já usado');
assert.ok(registerBlock.includes(CPF_ALREADY_REGISTERED_MESSAGE), 'swagger cita o CPF já usado');
assert.ok(!registerBlock.toLowerCase().includes('anti-enum'), 'cadastro não documenta anti-enumeração');
assert.ok(!registerBlock.includes('registerAcceptedResult'));

const cadastro = readFileSync(join(__dirname, '../../../../web/src/app/cadastro/page.tsx'), 'utf8');
assert.ok(cadastro.includes('saveSession'), 'cadastro grava a sessão como o login');
assert.ok(cadastro.includes('postRegisterPath'), 'depois do cadastro vai para next ou /conta');
assert.ok(!cadastro.includes('Entrar para continuar'), 'não pede um login extra');
assert.ok(!cadastro.includes('Se o e-mail ainda não estiver cadastrado'), 'não finge sucesso genérico');

const flow = readFileSync(join(__dirname, '../../../../web/src/lib/signup-flow.ts'), 'utf8');
assert.ok(flow.includes(EMAIL_ALREADY_REGISTERED_MESSAGE), 'web repete a mensagem de e-mail');
assert.ok(flow.includes(CPF_ALREADY_REGISTERED_MESSAGE), 'web repete a mensagem de CPF');

console.log('register session contract tests ok');
