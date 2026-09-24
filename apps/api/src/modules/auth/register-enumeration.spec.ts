/**
 * POST /auth/register opens a real session for a new customer.
 * Duplicate CPF and e-mail are distinct 409 messages (owner override of anti-enum).
 * Invalid CPF and under-18 stay 400. Cookie session matches login (issueAuthSession).
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  REGISTER_CPF_EXISTS_CODE,
  REGISTER_CPF_EXISTS_MESSAGE,
  REGISTER_EMAIL_EXISTS_CODE,
  REGISTER_EMAIL_EXISTS_MESSAGE,
  registerDuplicateConflict,
} from './register-public';

const cpfTaken = registerDuplicateConflict({ email: false, cpf: true });
const emailTaken = registerDuplicateConflict({ email: true, cpf: false });
const bothTaken = registerDuplicateConflict({ email: true, cpf: true });
const neither = registerDuplicateConflict({ email: false, cpf: false });

assert.ok(cpfTaken);
assert.equal(cpfTaken.field, 'cpf');
assert.equal(cpfTaken.code, REGISTER_CPF_EXISTS_CODE);
assert.equal(cpfTaken.message, 'Este CPF já possui conta. Entre ou use outro CPF.');
assert.equal(cpfTaken.message, REGISTER_CPF_EXISTS_MESSAGE);

assert.ok(emailTaken);
assert.equal(emailTaken.field, 'email');
assert.equal(emailTaken.code, REGISTER_EMAIL_EXISTS_CODE);
assert.equal(emailTaken.message, 'Este e-mail já possui conta. Faça login.');
assert.equal(emailTaken.message, REGISTER_EMAIL_EXISTS_MESSAGE);

assert.deepEqual(bothTaken, cpfTaken, 'CPF conflict wins when both identifiers are taken');
assert.equal(neither, null);

assert.ok(!REGISTER_CPF_EXISTS_MESSAGE.toLowerCase().includes('já cadastrado'));
assert.ok(REGISTER_CPF_EXISTS_MESSAGE.includes('CPF já possui conta'));
assert.ok(REGISTER_EMAIL_EXISTS_MESSAGE.includes('e-mail já possui conta'));

const svc = readFileSync(join(__dirname, 'auth.service.ts'), 'utf8');
const registerFn = svc.slice(svc.indexOf('async register('), svc.indexOf('private async notifyWelcome'));
assert.ok(registerFn.includes('async register('), 'register action present');
assert.ok(registerFn.includes('registerDuplicateConflict'), 'duplicates use the conflict helper');
assert.ok(registerFn.includes('throw new ConflictException'), 'duplicate CPF or e-mail is 409');
assert.ok(registerFn.includes('throw new BadRequestException(invalidCpf)'), 'invalid CPF stays 400');
assert.ok(registerFn.includes('throw new BadRequestException(invalidBirth)'), 'under-18 stays 400');
assert.ok(registerFn.includes('return this.issue('), 'new user gets the same session payload as login');
assert.ok(registerFn.includes('argon2.hash(dto.password)'), 'new password is hashed');
assert.ok(registerFn.includes('where: { cpf }'), 'CPF lookup is real');
assert.ok(registerFn.includes("e.code === 'P2002'"), 'unique race still becomes a conflict');
assert.ok(registerFn.includes("target.includes('cpf')"), 'P2002 on CPF uses the CPF message');
assert.ok(!registerFn.includes('registerAcceptedResult'), 'register no longer returns the generic payload');
assert.ok(!registerFn.includes('E-mail já cadastrado'));

const ctrl = readFileSync(join(__dirname, 'auth.controller.ts'), 'utf8');
const registerBlock = ctrl.slice(ctrl.indexOf('async register('), ctrl.indexOf("@Post('login')"));
const loginBlock = ctrl.slice(ctrl.indexOf('async login('), ctrl.indexOf("@Post('refresh')"));
assert.ok(registerBlock.includes('issueAuthSession(res, tokens)'), 'register sets sch_refresh like login');
assert.ok(registerBlock.includes('mergeGuest(tokens.user.id, guestToken)'), 'guest cart merges on register');
assert.ok(loginBlock.includes('issueAuthSession(res, tokens)'), 'login session helper unchanged');
assert.ok(loginBlock.includes('mergeGuest(tokens.user.id, guestToken)'));
assert.equal(
  registerBlock.includes('return ok(await this.auth.register'),
  false,
  'register must not return the service payload without a session',
);

const cadastro = readFileSync(join(__dirname, '../../../../web/src/app/cadastro/page.tsx'), 'utf8');
assert.ok(cadastro.includes('saveSession'), 'cadastro stores the register session');
assert.ok(cadastro.includes('window.location.href'), 'cadastro leaves the form for next or /conta');
assert.ok(cadastro.includes('readRegisterFailure'), 'cadastro maps CPF and e-mail conflicts');
assert.equal(cadastro.includes('Entrar para continuar'), false);
assert.equal(cadastro.includes('Faça login para continuar'), false);
assert.equal(cadastro.includes('registerAcceptedResult'), false);

const flow = readFileSync(
  join(__dirname, '../../../../web/src/components/account/CreateAccountFlow.tsx'),
  'utf8',
);
assert.ok(flow.includes('signup-cpf-error'), 'CPF conflict is shown on the CPF field');
assert.ok(flow.includes('serverIssue'), 'server conflict can move back to the CPF step');

const web = readFileSync(join(__dirname, '../../../../web/src/lib/signup-flow.ts'), 'utf8');
assert.ok(web.includes(REGISTER_CPF_EXISTS_MESSAGE), 'web copy matches the API CPF conflict');
assert.ok(web.includes(REGISTER_EMAIL_EXISTS_MESSAGE), 'web copy matches the API e-mail conflict');
assert.ok(web.includes('maskBirthDate'), 'birth date stays the DD/MM/AAAA mask');

console.log('register-enumeration unit tests ok');
