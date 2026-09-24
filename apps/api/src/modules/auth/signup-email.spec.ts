/**
 * POST /auth/signup-email is the passo 1 gate.
 * The body is only { exists }. Login and forgot-password stay the session and reset paths.
 */
import assert from 'assert';
import { validate } from 'class-validator';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SignupEmailDto } from './dto';
import { signupEmailCheck } from './signup-email';

const taken = signupEmailCheck(true);
const free = signupEmailCheck(false);
assert.deepEqual(taken, { exists: true });
assert.deepEqual(free, { exists: false });
assert.deepEqual(Object.keys(taken), ['exists'], 'response is a boolean and nothing else');
assert.equal('name' in taken, false);
assert.equal('cpf' in taken, false);
assert.equal('phone' in taken, false);
assert.equal('birthDate' in taken, false);
assert.equal('id' in taken, false);
assert.equal('passwordHash' in taken, false);

async function main() {
  const dto = new SignupEmailDto();
  dto.email = 'schimitzclaiton@gmail.com';
  assert.equal((await validate(dto)).length, 0);

  const bad = new SignupEmailDto();
  bad.email = 'nao-e-email';
  assert.ok((await validate(bad)).length > 0, 'invalid e-mail stays 400 via the DTO');

  const svc = readFileSync(join(__dirname, 'auth.service.ts'), 'utf8');
  const fn = svc.slice(svc.indexOf('async signupEmailExists('), svc.indexOf('async register('));
  assert.ok(fn.includes('async signupEmailExists('), 'lookup lives on AuthService');
  assert.ok(fn.includes('findUnique'), 'existence is a real user lookup');
  assert.ok(fn.includes('where: { email }'), 'lookup is by e-mail');
  assert.ok(fn.includes('select: { id: true }'), 'query does not load the profile');
  assert.ok(fn.includes('signupEmailCheck'), 'response goes through the boolean helper');
  assert.ok(fn.includes("trim().toLowerCase()"), 'e-mail is normalized like login');
  assert.equal(fn.includes('passwordHash'), false, 'lookup does not read the password hash');
  assert.equal(fn.includes('name:'), false, 'lookup does not read the name');
  assert.equal(fn.includes('cpf'), false, 'lookup does not read the CPF');
  assert.equal(fn.includes('birthDate'), false, 'lookup does not read the birth date');
  assert.equal(fn.includes('issue('), false, 'lookup does not open a session');

  const ctrl = readFileSync(join(__dirname, 'auth.controller.ts'), 'utf8');
  const block = ctrl.slice(ctrl.indexOf("@Post('signup-email')"), ctrl.indexOf("@Post('register')"));
  assert.ok(block.includes('async signupEmail('), 'route is POST /auth/signup-email');
  assert.ok(block.includes('signupEmailExists'), 'route uses the service lookup');
  assert.ok(block.includes('Throttle'), 'lookup is rate limited');
  assert.equal(block.includes('issueAuthSession'), false, 'lookup does not set sch_refresh');
  assert.ok(ctrl.includes("@Post('login')"), 'password sign-in stays POST /auth/login');
  assert.ok(ctrl.includes("@Post('forgot-password')"), 'reset stays POST /auth/forgot-password');

  console.log('signup-email unit tests ok');
}

void main();
