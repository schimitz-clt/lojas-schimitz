/**
 * Passo 1 checks whether the e-mail already has an account.
 * Taken → 409 with the same copy as POST /auth/register.
 * Free → { available: true }. No user row, no session, no account fields.
 */
import assert from 'assert';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AuthService } from './auth.service';
import { SignupEmailAvailabilityDto } from './dto';
import {
  REGISTER_EMAIL_EXISTS_CODE,
  REGISTER_EMAIL_EXISTS_MESSAGE,
} from './register-public';

function messagesOf(errors: { constraints?: Record<string, string> }[]): string[] {
  return errors.flatMap((error) => Object.values(error.constraints || {}));
}

async function dtoOf(email: string) {
  const dto = new SignupEmailAvailabilityDto();
  dto.email = email;
  return validate(dto);
}

type Lookup = { where: { email: string }; select: { id: true } };

function serviceWith(found: { id: string; name?: string; email?: string } | null, calls: Lookup[]) {
  const prisma = {
    user: {
      findUnique: async (args: Lookup) => {
        calls.push(args);
        return found;
      },
    },
  };
  return new AuthService(prisma as never, {} as never, {} as never, {} as never, {} as never);
}

async function main() {
  const calls: Lookup[] = [];
  const taken = serviceWith({ id: 'user-1', name: 'Claiton', email: 'schimitzclaiton@gmail.com' }, calls);
  await assert.rejects(
    () => taken.signupEmailAvailability('  SchimitzClaiton@Gmail.com  '),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      assert.equal(error.getStatus(), 409);
      const body = error.getResponse() as { message: string; code: string };
      assert.equal(body.message, REGISTER_EMAIL_EXISTS_MESSAGE);
      assert.equal(body.message, 'Este e-mail já possui conta. Faça login.');
      assert.equal(body.code, REGISTER_EMAIL_EXISTS_CODE);
      assert.equal(JSON.stringify(body).includes('user-1'), false);
      assert.equal(JSON.stringify(body).includes('Claiton'), false);
      assert.equal(JSON.stringify(body).includes('schimitzclaiton'), false);
      return true;
    },
  );
  assert.deepEqual(calls, [{ where: { email: 'schimitzclaiton@gmail.com' }, select: { id: true } }]);

  const freeCalls: Lookup[] = [];
  const free = serviceWith(null, freeCalls);
  assert.deepEqual(await free.signupEmailAvailability('  Nova@Loja.com '), { available: true });
  assert.deepEqual(freeCalls, [{ where: { email: 'nova@loja.com' }, select: { id: true } }]);

  const empty = serviceWith(null, []);
  await assert.rejects(
    () => empty.signupEmailAvailability('   '),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(error.getStatus(), 400);
      const body = error.getResponse();
      const message = typeof body === 'string' ? body : (body as { message?: string }).message;
      assert.equal(message, 'Informe um e-mail válido.');
      return true;
    },
  );

  const blank = messagesOf(await dtoOf(''));
  assert.ok(blank.includes('Informe um e-mail válido.'), blank.join(' | '));
  const malformed = messagesOf(await dtoOf('ana@loja'));
  assert.ok(malformed.includes('Informe um e-mail válido.'), malformed.join(' | '));
  assert.equal((await dtoOf('cliente@exemplo.com')).length, 0);
  const normalized = plainToInstance(SignupEmailAvailabilityDto, { email: '  Ana@Loja.com  ' });
  assert.equal(normalized.email, 'ana@loja.com');
  assert.equal((await validate(normalized)).length, 0);

  const svc = readFileSync(join(__dirname, 'auth.service.ts'), 'utf8');
  const checkFn = svc.slice(svc.indexOf('async signupEmailAvailability'), svc.indexOf('async register('));
  assert.ok(checkFn.includes('findUnique'), 'availability uses the user table');
  assert.ok(checkFn.includes('select: { id: true }'), 'lookup does not load the account');
  assert.ok(checkFn.includes('REGISTER_EMAIL_EXISTS_MESSAGE'), 'taken e-mail uses the register copy');
  assert.equal(checkFn.includes('user.create'), false, 'the check does not create a user');
  assert.equal(checkFn.includes('this.issue('), false, 'the check does not open a session');
  assert.ok(svc.includes('throw new ConflictException'), 'register still rejects duplicates');

  const ctrl = readFileSync(join(__dirname, 'auth.controller.ts'), 'utf8');
  const availabilityBlock = ctrl.slice(
    ctrl.indexOf("@Post('register/email-availability')"),
    ctrl.indexOf("@Post('register')"),
  );
  assert.ok(availabilityBlock.includes('signupEmailAvailability'), 'controller delegates the check');
  assert.ok(availabilityBlock.includes('SignupEmailAvailabilityDto'), 'body is only the e-mail');
  assert.equal(availabilityBlock.includes('issueAuthSession'), false, 'e-mail check does not set cookies');
  assert.equal(availabilityBlock.includes('mergeGuest'), false);
  const registerBlock = ctrl.slice(ctrl.indexOf('async register('), ctrl.indexOf("@Post('login')"));
  assert.ok(registerBlock.includes('issueAuthSession(res, tokens)'), 'register still opens the session');
  assert.ok(registerBlock.includes('this.auth.register'), 'final register is unchanged');

  const web = readFileSync(join(__dirname, '../../../../web/src/lib/signup-flow.ts'), 'utf8');
  assert.ok(web.includes("'/auth/register/email-availability'"), 'web calls the same path');
  assert.ok(web.includes(REGISTER_EMAIL_EXISTS_MESSAGE));

  console.log('signup-email-availability tests ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
