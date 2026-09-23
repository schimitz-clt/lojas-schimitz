import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  SIGNUP_PASSWORD_PATTERN,
  buildRegisterBody,
  continueFromEmail,
  maskCpf,
  signupBirthDateBounds,
  signupBirthDateIssue,
  signupCpfIssue,
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

const fixedNow = new Date('2026-09-23T15:00:00-03:00');

assert.equal(maskCpf('52998224725'), '529.982.247-25');
assert.equal(maskCpf('529.982.247-25'), '529.982.247-25');
assert.equal(maskCpf('52998224725999'), '529.982.247-25');
assert.equal(signupCpfIssue('')?.message, 'Informe seu CPF.');
assert.equal(signupCpfIssue('529.982.247-26')?.message, 'CPF inválido');
assert.equal(signupCpfIssue('111.111.111-11')?.message, 'CPF inválido');
assert.equal(signupCpfIssue('529.982.247-25'), null);
assert.equal(signupCpfIssue('11144477735'), null);

assert.equal(signupBirthDateIssue('', fixedNow)?.message, 'Informe a data de nascimento.');
assert.equal(signupBirthDateIssue('2008-09-24', fixedNow)?.message, 'É preciso ter 18 anos ou mais para criar a conta.');
assert.equal(signupBirthDateIssue('2024-02-31', fixedNow)?.message, 'Informe uma data de nascimento válida.');
assert.equal(signupBirthDateIssue('1905-09-23', fixedNow)?.message, 'Informe uma data de nascimento válida.');
assert.equal(signupBirthDateIssue('2008-09-23', fixedNow), null);
assert.equal(signupBirthDateIssue('1990-05-15', fixedNow), null);
assert.deepEqual(signupBirthDateBounds(fixedNow), { min: '1906-09-23', max: '2008-09-23' });

const base = {
  email: 'Ana@Loja.com',
  name: 'Ana Silva',
  cpf: '529.982.247-25',
  birthDate: '1990-05-15',
  phone: '',
  password: 'senha1234',
  confirmPassword: 'senha1234',
  acceptedPrivacy: true,
};

assert.equal(signupDetailsIssue(base, fixedNow), null);
assert.equal(signupDetailsIssue({ ...base, name: ' A ' }, fixedNow)?.field, 'name');
assert.equal(signupDetailsIssue({ ...base, cpf: '123' }, fixedNow)?.field, 'cpf');
assert.equal(signupDetailsIssue({ ...base, birthDate: '2015-01-01' }, fixedNow)?.field, 'birthDate');
assert.equal(signupDetailsIssue({ ...base, phone: '1'.repeat(33) }, fixedNow)?.field, 'phone');
assert.equal(signupDetailsIssue({ ...base, phone: '1'.repeat(32) }, fixedNow), null);
assert.equal(signupDetailsIssue({ ...base, password: 'curta1' }, fixedNow)?.message, 'A senha precisa ter no mínimo 8 caracteres.');
assert.equal(signupDetailsIssue({ ...base, password: 'somenteletras' }, fixedNow)?.message, 'Senha deve ter letras e números');
assert.equal(signupDetailsIssue({ ...base, password: '12345678' }, fixedNow)?.message, 'Senha deve ter letras e números');
assert.ok(SIGNUP_PASSWORD_PATTERN.test('Abcd1234'));
assert.equal(signupDetailsIssue({ ...base, confirmPassword: '' }, fixedNow)?.field, 'confirm');
assert.equal(signupDetailsIssue({ ...base, confirmPassword: 'senha1235' }, fixedNow)?.message, 'As senhas não conferem.');
assert.equal(signupDetailsIssue({ ...base, acceptedPrivacy: false }, fixedNow)?.field, 'privacy');
assert.equal(signupDetailsIssue({ ...base, email: 'ruim' }, fixedNow)?.field, 'email');

const withoutPhone = buildRegisterBody({
  email: '  Ana@Loja.com ',
  name: '  Ana Silva  ',
  cpf: '529.982.247-25',
  birthDate: ' 1990-05-15 ',
  phone: '   ',
  password: 'senha1234',
});
assert.deepEqual(withoutPhone, {
  name: 'Ana Silva',
  email: 'ana@loja.com',
  password: 'senha1234',
  cpf: '52998224725',
  birthDate: '1990-05-15',
});
assert.equal('phone' in withoutPhone, false);
assert.equal('confirmPassword' in withoutPhone, false);

const withPhone = buildRegisterBody({
  email: 'ana@loja.com',
  name: 'Ana Silva',
  cpf: '52998224725',
  birthDate: '1990-05-15',
  phone: ' (51) 99999-0000 ',
  password: 'senha1234',
});
assert.deepEqual(Object.keys(withPhone).sort(), ['birthDate', 'cpf', 'email', 'name', 'password', 'phone']);
assert.equal(withPhone.phone, '(51) 99999-0000');
assert.equal(withPhone.cpf, '52998224725');

const dto = readFileSync(join(__dirname, '../../../api/src/modules/auth/dto.ts'), 'utf8');
const registerDto = dto.slice(dto.indexOf('export class RegisterDto'), dto.indexOf('export class LoginDto'));
assert.ok(registerDto.includes('@IsEmail()'), 'register email stays an e-mail');
assert.ok(registerDto.includes('password!'), 'register requires password');
assert.ok(registerDto.includes('name!'), 'register requires name');
assert.ok(registerDto.includes('phone?: string'), 'phone stays optional');
assert.ok(registerDto.includes(SIGNUP_PASSWORD_PATTERN.source), 'client password rule matches RegisterDto');
assert.ok(registerDto.includes('cpf!: string'), 'register requires CPF');
assert.ok(registerDto.includes('birthDate!: string'), 'register requires birth date');
assert.ok(registerDto.includes('@IsBrazilianCpf()'), 'CPF check digits live on the DTO');
assert.ok(registerDto.includes('@IsAdultBirthDate()'), 'age rule lives on the DTO');

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
assert.ok(details.includes('signup-cpf'), 'step 2 asks for CPF');
assert.ok(details.includes('CPF'), 'CPF label is Portuguese');
assert.ok(details.includes('Data de nascimento'), 'step 2 asks for birth date');
assert.ok(details.includes('maskCpf'), 'CPF input is masked');
assert.ok(details.includes('type="date"'), 'birth date uses the native mobile picker');
assert.ok(details.includes('signup-birth'), 'birth date field is present');
assert.equal(/localStorage\.setItem\(\s*['"]sch_(access|refresh)/.test(flow), false, 'signup UI does not store JWTs');

const entrar = readFileSync(join(__dirname, '../app/entrar/page.tsx'), 'utf8');
assert.ok(entrar.includes('/auth/register'), 'entrar still registers on the real endpoint');
assert.ok(entrar.includes('/auth/login'), 'register then login still issues the session');
assert.ok(entrar.includes('saveSession'), 'login still uses the cookie-first session helper');
assert.ok(entrar.includes('CreateAccountFlow'), 'entrar register mode is the multi-step flow');
assert.ok(entrar.includes('Esqueci minha senha'), 'login recovery stays available');
assert.equal(/localStorage\.setItem\(\s*['"]sch_(access|refresh)/.test(entrar), false, 'entrar does not store JWTs');
const loginTab = entrar.slice(entrar.indexOf("mode === 'login'"), entrar.indexOf('<CreateAccountFlow'));
assert.equal(/cpf|nascimento|birthDate/i.test(loginTab), false, 'Entrar tab stays email and password only');

const cadastro = readFileSync(join(__dirname, '../app/cadastro/page.tsx'), 'utf8');
assert.ok(cadastro.includes('/auth/register'), 'standalone cadastro still posts register');
assert.ok(cadastro.includes('CreateAccountFlow'), 'standalone cadastro uses the same steps');
assert.equal(cadastro.includes('saveSession'), false, 'standalone cadastro stays anti-enum (no auto-login)');

console.log('signup-flow tests ok');
