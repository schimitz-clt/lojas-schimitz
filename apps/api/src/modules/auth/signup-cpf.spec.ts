/**
 * POST /auth/signup-cpf runs only for a valid CPF in the signup flow.
 * The body is { exists: false } or { exists: true, maskedEmail }. Never the raw e-mail.
 * Password sign-in is POST /auth/login-cpf (same sch_refresh session as /auth/login).
 */
import assert from 'assert';
import { validate } from 'class-validator';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ForgotPasswordCpfDto, LoginCpfDto, SignupCpfDto } from './dto';
import { SIGNUP_CPF_EMAIL_HIDDEN, maskAccountEmail, signupCpfCheck } from './signup-cpf';

assert.equal(maskAccountEmail('schimitzclaiton@gmail.com'), 'sch***@gmail.com');
assert.equal(maskAccountEmail('  Ana@Loja.com '), 'an***@loja.com');
assert.equal(maskAccountEmail('ab@gmail.com'), 'a***@gmail.com');
assert.equal(maskAccountEmail('a@gmail.com'), 'a***@gmail.com');
assert.equal(maskAccountEmail('joao.silva@lojas.com.br'), 'joa***@lojas.com.br');
assert.equal(maskAccountEmail('sem-arroba'), null);
assert.equal(maskAccountEmail(''), null);

for (const email of ['schimitzclaiton@gmail.com', 'Ana@Loja.com', 'ab@gmail.com', 'joao.silva@lojas.com.br']) {
  const masked = maskAccountEmail(email);
  assert.ok(masked, email);
  assert.notEqual(masked, email.trim().toLowerCase());
  const local = email.trim().toLowerCase().split('@')[0];
  const shown = masked.split('***@')[0];
  if (local.length > 1) assert.ok(shown.length < local.length, `${email} → ${masked}`);
  assert.equal(masked.includes(local + '@'), false, 'full local part is not in the mask');
}

const free = signupCpfCheck(null);
const empty = signupCpfCheck('   ');
const taken = signupCpfCheck('schimitzclaiton@gmail.com');
const hidden = signupCpfCheck('nao-e-email');
assert.deepEqual(free, { exists: false });
assert.deepEqual(empty, { exists: false });
assert.deepEqual(Object.keys(free), ['exists']);
assert.deepEqual(taken, { exists: true, maskedEmail: 'sch***@gmail.com' });
assert.deepEqual(Object.keys(taken), ['exists', 'maskedEmail']);
assert.equal('email' in taken, false);
assert.equal('name' in taken, false);
assert.equal('cpf' in taken, false);
assert.equal('id' in taken, false);
assert.equal('passwordHash' in taken, false);
assert.equal(hidden.exists, true);
if (!hidden.exists) throw new Error('hidden account must exist');
assert.equal(hidden.maskedEmail, SIGNUP_CPF_EMAIL_HIDDEN);
assert.equal(hidden.maskedEmail.includes('@gmail'), false);

async function main() {
  const dto = new SignupCpfDto();
  dto.cpf = '529.982.247-25';
  assert.equal((await validate(dto)).length, 0, 'valid CPF passes the DTO');

  const bad = new SignupCpfDto();
  bad.cpf = '111.111.111-11';
  assert.ok((await validate(bad)).length > 0, 'invalid CPF stays 400 via the DTO');

  const login = new LoginCpfDto();
  login.cpf = '52998224725';
  login.password = 'senha1234';
  assert.equal((await validate(login)).length, 0);

  const forgot = new ForgotPasswordCpfDto();
  forgot.cpf = '52998224725';
  assert.equal((await validate(forgot)).length, 0);

  const svc = readFileSync(join(__dirname, 'auth.service.ts'), 'utf8');
  const fn = svc.slice(svc.indexOf('async signupCpfAccount('), svc.indexOf('async login('));
  assert.ok(fn.includes('async signupCpfAccount('), 'lookup lives on AuthService');
  assert.ok(fn.includes('cpfError'), 'invalid CPF is rejected before the query');
  assert.ok(fn.includes('findUnique'), 'existence is a real user lookup');
  assert.ok(fn.includes('where: { cpf }'), 'lookup is by CPF');
  assert.ok(fn.includes('select: { email: true }'), 'query loads only the e-mail to mask');
  assert.ok(fn.includes('signupCpfCheck'), 'response goes through the mask helper');
  assert.equal(fn.includes('passwordHash'), false, 'lookup does not read the password hash');
  assert.equal(fn.includes('name:'), false, 'lookup does not read the name');
  assert.equal(fn.includes('birthDate'), false, 'lookup does not read the birth date');
  assert.equal(fn.includes('phone'), false, 'lookup does not read the phone');
  assert.equal(fn.includes('issue('), false, 'lookup does not open a session');
  assert.equal(fn.includes('return user'), false, 'lookup does not return the user row');

  const loginFn = svc.slice(svc.indexOf('async loginWithCpf('), svc.indexOf('async forgotPassword('));
  assert.ok(loginFn.includes('argon2.verify'), 'CPF login checks the account password');
  assert.ok(loginFn.includes('Credenciais inválidas'), 'unknown CPF and bad password share one error');
  assert.ok(loginFn.includes('return this.issue('), 'success is the same session payload as login');
  assert.equal(loginFn.includes('user.create'), false, 'CPF login does not create a user');
  assert.equal(loginFn.includes('maskedEmail'), false, 'login response is not the probe payload');

  const forgotFn = svc.slice(svc.indexOf('async forgotPasswordByCpf('), svc.indexOf('async resetPassword('));
  assert.ok(forgotFn.includes('deliverPasswordReset'), 'CPF reset uses the same e-mail delivery as forgot-password');
  assert.ok(forgotFn.includes('cpfError'), 'invalid CPF does not reach the mailer');
  assert.equal(forgotFn.includes('return {') && forgotFn.includes('email:'), false, 'reset probe does not return the e-mail');
  assert.ok(forgotFn.includes('return RESET_GENERIC'), 'missing CPF still gets the generic message');
  assert.equal(forgotFn.includes('maskedEmail'), false, 'reset does not build a mask to send back');

  const ctrl = readFileSync(join(__dirname, 'auth.controller.ts'), 'utf8');
  const probe = ctrl.slice(ctrl.indexOf("@Post('signup-cpf')"), ctrl.indexOf("@Post('register')"));
  assert.ok(probe.includes('async signupCpf('), 'route is POST /auth/signup-cpf');
  assert.ok(probe.includes('signupCpfAccount'), 'route uses the service lookup');
  assert.ok(probe.includes('Throttle'), 'lookup is rate limited');
  assert.ok(probe.includes('limit: 5'), 'CPF probe is tighter than the e-mail probe');
  assert.equal(probe.includes('issueAuthSession'), false, 'lookup does not set sch_refresh');

  const loginRoute = ctrl.slice(ctrl.indexOf("@Post('login-cpf')"), ctrl.indexOf("@Post('refresh')"));
  assert.ok(loginRoute.includes('loginWithCpf'), 'password sign-in is POST /auth/login-cpf');
  assert.ok(loginRoute.includes('issueAuthSession'), 'CPF login sets the same cookies as /auth/login');
  assert.ok(loginRoute.includes('mergeGuest'), 'guest cart merges on CPF login');

  const forgotRoute = ctrl.slice(ctrl.indexOf("@Post('forgot-password-cpf')"), ctrl.indexOf("@Post('reset-password')"));
  assert.ok(forgotRoute.includes('forgotPasswordByCpf'), 'Esqueci senha do CPF usa o e-mail da conta');
  assert.ok(forgotRoute.includes('Throttle'), 'CPF reset is rate limited');
  assert.equal(forgotRoute.includes('issueAuthSession'), false, 'reset request does not open a session');
  assert.ok(ctrl.includes("@Post('login')"), 'e-mail sign-in stays POST /auth/login');
  assert.ok(ctrl.includes("@Post('forgot-password')"), 'e-mail reset stays POST /auth/forgot-password');

  console.log('signup-cpf unit tests ok');
}

void main();
