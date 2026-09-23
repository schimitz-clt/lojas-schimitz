/**
 * Public /auth/register must not reveal whether an e-mail is already registered.
 * Source lock + identical success payload for both branches.
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { REGISTER_ACCEPTED_MESSAGE, registerAcceptedResult } from './register-public';

const newEmail = registerAcceptedResult();
const existingEmail = registerAcceptedResult();

assert.deepEqual(newEmail, existingEmail);
assert.equal(newEmail.accepted, true);
assert.equal(existingEmail.accepted, true);
assert.equal(newEmail.message, REGISTER_ACCEPTED_MESSAGE);
assert.equal(existingEmail.message, REGISTER_ACCEPTED_MESSAGE);
assert.equal(JSON.stringify(newEmail), JSON.stringify(existingEmail));
assert.ok(!JSON.stringify(newEmail).toLowerCase().includes('já cadastrado'));
assert.ok(!JSON.stringify(newEmail).toLowerCase().includes('already'));
assert.equal('accessToken' in newEmail, false);
assert.equal('user' in newEmail, false);

const svc = readFileSync(join(__dirname, 'auth.service.ts'), 'utf8');
assert.ok(!svc.includes('E-mail já cadastrado'), 'register must not say the e-mail exists');
assert.ok(svc.includes('registerAcceptedResult'), 'register returns the generic payload');
assert.ok(svc.includes('argon2.hash(dto.password)'), 'register always hashes (timing)');
assert.ok(svc.includes('where: { cpf }'), 'duplicate CPF uses the same lookup-then-generic path');
assert.ok(!svc.includes('CPF já'), 'register must not say the CPF exists');
assert.ok(
  !/async register\([\s\S]*throw new ConflictException/.test(svc),
  'register must not 409 on existing e-mail or CPF',
);

const ctrl = readFileSync(join(__dirname, 'auth.controller.ts'), 'utf8');
assert.ok(
  ctrl.includes('return ok(await this.auth.register(dto, clientIp(req), guestToken));'),
  'register HTTP envelope is generic ok()',
);
const registerBlock = ctrl.slice(ctrl.indexOf('async register('), ctrl.indexOf('@Post(\'login\')'));
assert.ok(registerBlock.includes('async register('), 'register action present');
assert.ok(!registerBlock.includes('issueAuthSession'), 'register must not issue a session');

const cadastro = readFileSync(
  join(__dirname, '../../../../web/src/app/cadastro/page.tsx'),
  'utf8',
);
assert.ok(cadastro.includes('REGISTER_ACCEPTED_MESSAGE') || cadastro.includes('data.message'), 'cadastro shows generic copy');
assert.ok(!cadastro.includes('saveSession'), 'cadastro must not auto-login (would enumerate via tokens)');

console.log('register-enumeration unit tests ok');
