import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  SIGNUP_PASSWORD_PATTERN,
  buildRegisterBody,
  continueFromEmail,
  signupDetailsIssue,
  signupEmailForApi,
  signupEmailIssue,
} from './signup-flow';

assert.equal(signupEmailIssue('')?.message, 'Informe seu e-mail para continuar.');
assert.equal(signupEmailIssue('   ')?.field, 'email');
assert.equal(signupEmailIssue('ana')?.message, 'Informe um e-mail válido.');
assert.equal(signupEmailIssue('ana@loja')?.message, 'Informe um e-mail válido.');
assert.equal(signupEmailIssue('ana@@loja.com')?.message, 'Informe um e-mail válido.');
assert.equal(signupEmailIssue('ana..silva@loja.com')?.message, 'Informe um e-mail válido.');
assert.equal(signupEmailIssue('ana@loja.com'), null);

const blocked = continueFromEmail('  ');
assert.equal(blocked.ok, false);
const advanced = continueFromEmail('  Ana@Loja.com  ');
assert.equal(advanced.ok, true);
if (advanced.ok) assert.equal(advanced.displayEmail, 'Ana@Loja.com');
assert.equal(signupEmailForApi('  Ana@Loja.com  '), 'ana@loja.com');

const base = {
  email: 'Ana@Loja.com',
  name: 'Ana Silva',
  phone: '',
  password: 'senha1234',
  confirmPassword: 'senha1234',
  acceptedPrivacy: true,
};

assert.equal(signupDetailsIssue(base), null);
assert.equal(signupDetailsIssue({ ...base, name: ' A ' })?.field, 'name');
assert.equal(signupDetailsIssue({ ...base, phone: '1'.repeat(33) })?.field, 'phone');
assert.equal(signupDetailsIssue({ ...base, phone: '1'.repeat(32) }), null);
assert.equal(signupDetailsIssue({ ...base, password: 'curta1' })?.message, 'A senha precisa ter no mínimo 8 caracteres.');
assert.equal(signupDetailsIssue({ ...base, password: 'somenteletras' })?.message, 'Senha deve ter letras e números');
assert.equal(signupDetailsIssue({ ...base, password: '12345678' })?.message, 'Senha deve ter letras e números');
assert.ok(SIGNUP_PASSWORD_PATTERN.test('Abcd1234'));
assert.equal(signupDetailsIssue({ ...base, confirmPassword: '' })?.field, 'confirm');
assert.equal(signupDetailsIssue({ ...base, confirmPassword: 'senha1235' })?.message, 'As senhas não conferem.');
assert.equal(signupDetailsIssue({ ...base, acceptedPrivacy: false })?.field, 'privacy');
assert.equal(signupDetailsIssue({ ...base, email: 'ruim' })?.field, 'email');

const withoutPhone = buildRegisterBody({
  email: '  Ana@Loja.com ',
  name: '  Ana Silva  ',
  phone: '   ',
  password: 'senha1234',
});
assert.deepEqual(withoutPhone, {
  name: 'Ana Silva',
  email: 'ana@loja.com',
  password: 'senha1234',
});
assert.equal('phone' in withoutPhone, false);
assert.equal('confirmPassword' in withoutPhone, false);

const withPhone = buildRegisterBody({
  email: 'ana@loja.com',
  name: 'Ana Silva',
  phone: ' (51) 99999-0000 ',
  password: 'senha1234',
});
assert.deepEqual(Object.keys(withPhone).sort(), ['email', 'name', 'password', 'phone']);
assert.equal(withPhone.phone, '(51) 99999-0000');

const dto = readFileSync(join(__dirname, '../../../api/src/modules/auth/dto.ts'), 'utf8');
const registerDto = dto.slice(dto.indexOf('export class RegisterDto'), dto.indexOf('export class LoginDto'));
assert.ok(registerDto.includes('@IsEmail()'), 'register email stays an e-mail');
assert.ok(registerDto.includes('password!'), 'register requires password');
assert.ok(registerDto.includes('name!'), 'register requires name');
assert.ok(registerDto.includes('phone?: string'), 'phone stays optional');
assert.ok(registerDto.includes(SIGNUP_PASSWORD_PATTERN.source), 'client password rule matches RegisterDto');
assert.equal(/cpf|birth|nascimento/i.test(registerDto), false, 'API register has no CPF or birth date');

const flow = readFileSync(join(__dirname, '../components/account/CreateAccountFlow.tsx'), 'utf8');
assert.ok(flow.includes('data-signup-step="email"'), 'step 1 collects e-mail');
assert.ok(flow.includes('Cadastrar e continuar'), 'Portuguese register CTA');
assert.ok(flow.includes('Já tenho conta'), 'path back to login');
assert.ok(flow.includes('Lojas Schimitz'), 'store name on the fixed header');
assert.ok(flow.includes('/privacidade'), 'privacy policy is the existing page');
assert.ok(flow.includes('buildRegisterBody'), 'submit uses the real register payload');
const details = flow.slice(flow.indexOf('data-signup-step="details"'));
assert.ok(details.includes('data-fixed-email'), 'chosen e-mail is fixed on step 2');
assert.equal(details.includes('type="email"'), false, 'step 2 does not ask for e-mail again');
assert.equal(/cpf|nascimento|birthDate/i.test(flow), false, 'UI does not invent CPF or birth date');
assert.equal(/localStorage\.setItem\(\s*['"]sch_(access|refresh)/.test(flow), false, 'signup UI does not store JWTs');

const entrar = readFileSync(join(__dirname, '../app/entrar/page.tsx'), 'utf8');
assert.ok(entrar.includes('/auth/register'), 'entrar still registers on the real endpoint');
assert.ok(entrar.includes('/auth/login'), 'register then login still issues the session');
assert.ok(entrar.includes('saveSession'), 'login still uses the cookie-first session helper');
assert.ok(entrar.includes('CreateAccountFlow'), 'entrar register mode is the multi-step flow');
assert.ok(entrar.includes('Esqueci minha senha'), 'login recovery stays available');
assert.equal(/localStorage\.setItem\(\s*['"]sch_(access|refresh)/.test(entrar), false, 'entrar does not store JWTs');

const cadastro = readFileSync(join(__dirname, '../app/cadastro/page.tsx'), 'utf8');
assert.ok(cadastro.includes('/auth/register'), 'standalone cadastro still posts register');
assert.ok(cadastro.includes('CreateAccountFlow'), 'standalone cadastro uses the same steps');
assert.equal(cadastro.includes('saveSession'), false, 'standalone cadastro stays anti-enum (no auto-login)');

console.log('signup-flow tests ok');
