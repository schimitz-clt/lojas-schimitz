import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  SIGNUP_CPF_INVALID_MESSAGE,
  SIGNUP_NAME_GIBBERISH_MESSAGE,
  SIGNUP_NAME_NUMBERS_MESSAGE,
  SIGNUP_NAME_SURNAME_MESSAGE,
  SIGNUP_PASSWORD_PATTERN,
  SIGNUP_PHONE_INVALID_MESSAGE,
  REGISTER_CPF_EXISTS_MESSAGE,
  REGISTER_EMAIL_EXISTS_MESSAGE,
  birthDateToIso,
  buildRegisterBody,
  continueFromEmail,
  maskBirthDate,
  maskCpf,
  readRegisterFailure,
  signupAccessIssue,
  signupBirthDateBounds,
  signupBirthDateDisplayIssue,
  signupBirthDateIssue,
  signupCpfIssue,
  signupDetailsIssue,
  signupEmailForApi,
  signupEmailIssue,
  signupNameIssue,
  signupPhoneIssue,
  signupProfileIssue,
  signupRegisterConflict,
} from './signup-flow';

assert.equal(signupEmailIssue('')?.message, 'Informe seu e-mail para continuar.');
assert.equal(signupEmailIssue('   ')?.field, 'email');
assert.equal(signupEmailIssue('ana')?.message, 'Informe um e-mail válido.');
assert.equal(signupEmailIssue('ana@loja')?.message, 'Informe um e-mail válido.');
assert.equal(signupEmailIssue('ana@@loja.com')?.message, 'Informe um e-mail válido.');
assert.equal(signupEmailIssue('ana..silva@loja.com')?.message, 'Informe um e-mail válido.');
assert.equal(signupEmailIssue('ana@loja.com'), null);

assert.equal(signupRegisterConflict({ code: 'CPF_ALREADY_REGISTERED' })?.field, 'cpf');
assert.equal(
  signupRegisterConflict({ message: REGISTER_CPF_EXISTS_MESSAGE })?.message,
  'Este CPF já possui conta. Entre ou use outro CPF.',
);
assert.equal(signupRegisterConflict({ code: 'EMAIL_ALREADY_REGISTERED' })?.field, 'email');
assert.equal(
  signupRegisterConflict({ message: REGISTER_EMAIL_EXISTS_MESSAGE })?.message,
  'Este e-mail já possui conta. Faça login.',
);
assert.equal(signupRegisterConflict({ message: 'CPF inválido' }), null);
const cpfFailure = readRegisterFailure(
  Object.assign(new Error(REGISTER_CPF_EXISTS_MESSAGE), { code: 'CPF_ALREADY_REGISTERED' }),
);
assert.equal(cpfFailure.conflict?.field, 'cpf');
const emailFailure = readRegisterFailure(
  Object.assign(new Error(REGISTER_EMAIL_EXISTS_MESSAGE), { code: 'EMAIL_ALREADY_REGISTERED' }),
);
assert.equal(emailFailure.conflict?.field, 'email');
assert.equal(readRegisterFailure(new Error('Senha deve ter letras e números')).conflict, null);

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
assert.equal(signupCpfIssue('529.982.247-26')?.message, SIGNUP_CPF_INVALID_MESSAGE);
assert.equal(signupCpfIssue('034.268.570-80')?.message, SIGNUP_CPF_INVALID_MESSAGE);
assert.equal(signupCpfIssue('111.111.111-11')?.message, SIGNUP_CPF_INVALID_MESSAGE);
assert.equal(signupCpfIssue('000.000.000-00')?.message, SIGNUP_CPF_INVALID_MESSAGE);
assert.equal(signupCpfIssue('529.982.247-25'), null);
assert.equal(signupCpfIssue('034.268.570-81'), null);
assert.equal(signupCpfIssue('11144477735'), null);
assert.equal(signupNameIssue('')?.message, 'Informe seu nome completo.');
assert.equal(signupNameIssue(' A ')?.message, 'Informe seu nome completo.');
assert.equal(signupNameIssue('Claiton')?.message, SIGNUP_NAME_SURNAME_MESSAGE);
assert.equal(signupNameIssue('123 456')?.message, SIGNUP_NAME_NUMBERS_MESSAGE);
assert.equal(signupNameIssue('Ana 2')?.message, SIGNUP_NAME_NUMBERS_MESSAGE);
assert.equal(signupNameIssue('da Silva')?.message, SIGNUP_NAME_SURNAME_MESSAGE);
assert.equal(signupNameIssue('Ana Silva'), null);
assert.equal(signupNameIssue('Claiton da silva schimi')?.message, SIGNUP_NAME_GIBBERISH_MESSAGE);
assert.equal(signupNameIssue('Schimi Silva')?.message, SIGNUP_NAME_GIBBERISH_MESSAGE);
assert.equal(signupNameIssue('Maria asdf')?.message, SIGNUP_NAME_GIBBERISH_MESSAGE);
assert.equal(signupNameIssue('Fulano Silva')?.message, SIGNUP_NAME_GIBBERISH_MESSAGE);
assert.equal(signupNameIssue('Ana aaa')?.message, SIGNUP_NAME_GIBBERISH_MESSAGE);
assert.equal(signupNameIssue('CPF Ruim')?.message, SIGNUP_NAME_GIBBERISH_MESSAGE);
assert.equal(signupNameIssue('Claiton da Silva Schimitz'), null);
assert.equal(signupNameIssue('Claiton Schmidt'), null);
assert.equal(signupNameIssue('Philip Souza'), null);
assert.equal(signupNameIssue('José da Silva'), null);
assert.equal(signupNameIssue('Maria-Clara Souza'), null);
assert.equal(signupNameIssue('Conceição Alves'), null);
assert.equal(signupPhoneIssue(''), null);
assert.equal(signupPhoneIssue('   '), null);
assert.equal(signupPhoneIssue('51980653799'), null);
assert.equal(signupPhoneIssue('(51) 99999-0000'), null);
assert.equal(signupPhoneIssue('+55 51 98065-3799'), null);
assert.equal(signupPhoneIssue('abc')?.message, SIGNUP_PHONE_INVALID_MESSAGE);
assert.equal(signupPhoneIssue('123')?.message, SIGNUP_PHONE_INVALID_MESSAGE);
assert.equal(signupPhoneIssue('11111111111')?.message, SIGNUP_PHONE_INVALID_MESSAGE);
assert.equal(signupPhoneIssue('5133334444')?.message, SIGNUP_PHONE_INVALID_MESSAGE);

assert.equal(signupBirthDateIssue('', fixedNow)?.message, 'Informe a data de nascimento.');
assert.equal(signupBirthDateIssue('2008-09-24', fixedNow)?.message, 'É preciso ter 18 anos ou mais para criar a conta.');
assert.equal(signupBirthDateIssue('2024-02-31', fixedNow)?.message, 'Informe uma data de nascimento válida.');
assert.equal(signupBirthDateIssue('1905-09-23', fixedNow)?.message, 'Informe uma data de nascimento válida.');
assert.equal(signupBirthDateIssue('2008-09-23', fixedNow), null);
assert.equal(signupBirthDateIssue('1990-05-15', fixedNow), null);
assert.deepEqual(signupBirthDateBounds(fixedNow), { min: '1906-09-23', max: '2008-09-23' });

assert.equal(maskBirthDate(''), '');
assert.equal(maskBirthDate('0'), '0');
assert.equal(maskBirthDate('08'), '08/');
assert.equal(maskBirthDate('080'), '08/0');
assert.equal(maskBirthDate('0803'), '08/03/');
assert.equal(maskBirthDate('08031'), '08/03/1');
assert.equal(maskBirthDate('08031990'), '08/03/1990');
assert.equal(maskBirthDate('08/03/1990'), '08/03/1990');
assert.equal(maskBirthDate('080319901234'), '08/03/1990');
assert.equal(maskBirthDate('0a8b03c1990'), '08/03/1990');
assert.equal(maskBirthDate('1990-05-15'), '15/05/1990');
assert.equal(maskBirthDate('08', '08/'), '0');
assert.equal(maskBirthDate('08/03', '08/03/'), '08/0');
assert.equal(maskBirthDate('08/03/199', '08/03/1990'), '08/03/199');

assert.equal(birthDateToIso(''), null);
assert.equal(birthDateToIso('08'), null);
assert.equal(birthDateToIso('08/'), null);
assert.equal(birthDateToIso('08/03'), null);
assert.equal(birthDateToIso('08/03/'), null);
assert.equal(birthDateToIso('08/03/199'), null);
assert.equal(birthDateToIso('08/03/1990'), '1990-03-08');
assert.equal(birthDateToIso('  15/05/1990  '), '1990-05-15');
assert.equal(birthDateToIso('1990-05-15'), '1990-05-15');
assert.equal(birthDateToIso('31/02/2024'), '2024-02-31');
assert.equal(birthDateToIso('15/13/1990'), '1990-13-15');

assert.equal(signupBirthDateDisplayIssue('', fixedNow)?.message, 'Informe a data de nascimento.');
assert.equal(signupBirthDateDisplayIssue('08/', fixedNow)?.message, 'Informe a data de nascimento no formato DD/MM/AAAA.');
assert.equal(signupBirthDateDisplayIssue('08/03/', fixedNow)?.message, 'Informe a data de nascimento no formato DD/MM/AAAA.');
assert.equal(signupBirthDateDisplayIssue('08/03/199', fixedNow)?.message, 'Informe a data de nascimento no formato DD/MM/AAAA.');
assert.equal(signupBirthDateDisplayIssue('31/02/2024', fixedNow)?.message, 'Informe uma data de nascimento válida.');
assert.equal(signupBirthDateDisplayIssue('15/13/1990', fixedNow)?.message, 'Informe uma data de nascimento válida.');
assert.equal(signupBirthDateDisplayIssue('32/01/1990', fixedNow)?.message, 'Informe uma data de nascimento válida.');
assert.equal(signupBirthDateDisplayIssue('29/02/2023', fixedNow)?.message, 'Informe uma data de nascimento válida.');
assert.equal(signupBirthDateDisplayIssue('29/02/2000', fixedNow), null);
assert.equal(signupBirthDateDisplayIssue('24/09/2008', fixedNow)?.message, 'É preciso ter 18 anos ou mais para criar a conta.');
assert.equal(signupBirthDateDisplayIssue('23/09/1905', fixedNow)?.message, 'Informe uma data de nascimento válida.');
assert.equal(signupBirthDateDisplayIssue('23/09/2008', fixedNow), null);
assert.equal(signupBirthDateDisplayIssue('15/05/1990', fixedNow), null);
assert.equal(signupBirthDateDisplayIssue('1990-05-15', fixedNow), null);
assert.equal(signupBirthDateDisplayIssue('08/02/1991', fixedNow), null);
assert.equal(signupBirthDateDisplayIssue('29/02/1991', fixedNow)?.message, 'Informe uma data de nascimento válida.');
assert.equal(signupBirthDateDisplayIssue('31/04/1991', fixedNow)?.message, 'Informe uma data de nascimento válida.');
assert.equal(signupBirthDateDisplayIssue('08/02/199', fixedNow)?.message, 'Informe a data de nascimento no formato DD/MM/AAAA.');
assert.equal(signupBirthDateDisplayIssue('8/2/1991', fixedNow)?.message, 'Informe a data de nascimento no formato DD/MM/AAAA.');
assert.equal(String(signupBirthDateDisplayIssue('08/03', fixedNow)?.message).includes('AAAA-MM-DD'), false);

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

assert.equal(
  signupProfileIssue(
    { name: base.name, cpf: base.cpf, birthDate: base.birthDate, phone: base.phone },
    fixedNow,
  ),
  null,
);
assert.equal(
  signupProfileIssue(
    { name: ' A ', cpf: base.cpf, birthDate: base.birthDate, phone: '' },
    fixedNow,
  )?.field,
  'name',
);
assert.equal(
  signupProfileIssue(
    { name: base.name, cpf: base.cpf, birthDate: '15/05/1990', phone: '' },
    fixedNow,
  ),
  null,
);
assert.equal(
  signupProfileIssue(
    { name: base.name, cpf: base.cpf, birthDate: '24/09/2008', phone: '' },
    fixedNow,
  )?.message,
  'É preciso ter 18 anos ou mais para criar a conta.',
);
assert.equal(
  signupProfileIssue(
    { name: base.name, cpf: base.cpf, birthDate: '08/03', phone: '' },
    fixedNow,
  )?.message,
  'Informe a data de nascimento no formato DD/MM/AAAA.',
);
assert.equal(
  signupProfileIssue(
    { name: ' A ', cpf: base.cpf, birthDate: '08/', phone: '' },
    fixedNow,
  )?.field,
  'name',
);
assert.equal(
  signupAccessIssue({ password: 'senha1234', confirmPassword: 'senha1234', acceptedPrivacy: true }),
  null,
);
assert.equal(
  signupAccessIssue({ password: 'senha1234', confirmPassword: 'senha1234', acceptedPrivacy: false })?.field,
  'privacy',
);
assert.equal(signupDetailsIssue(base, fixedNow), null);
assert.equal(signupDetailsIssue({ ...base, name: ' A ' }, fixedNow)?.field, 'name');
assert.equal(signupDetailsIssue({ ...base, cpf: '123' }, fixedNow)?.field, 'cpf');
assert.equal(signupDetailsIssue({ ...base, birthDate: '2015-01-01' }, fixedNow)?.field, 'birthDate');
assert.equal(signupDetailsIssue({ ...base, birthDate: '15/05/1990' }, fixedNow), null);
assert.equal(
  signupDetailsIssue({ ...base, birthDate: '08/03' }, fixedNow)?.message,
  'Informe a data de nascimento no formato DD/MM/AAAA.',
);
assert.equal(signupDetailsIssue({ ...base, phone: '1'.repeat(33) }, fixedNow)?.field, 'phone');
assert.equal(signupDetailsIssue({ ...base, phone: '1'.repeat(32) }, fixedNow)?.message, SIGNUP_PHONE_INVALID_MESSAGE);
assert.equal(signupDetailsIssue({ ...base, phone: '51980653799' }, fixedNow), null);
assert.equal(
  signupNameIssue('Claiton da silva schimi')?.message,
  SIGNUP_NAME_GIBBERISH_MESSAGE,
);
assert.equal(signupCpfIssue('034.268.570-80')?.message, SIGNUP_CPF_INVALID_MESSAGE);
assert.equal(signupBirthDateDisplayIssue('08/02/1991', fixedNow), null);
assert.equal(signupPhoneIssue('51980653799'), null);
assert.equal(
  signupProfileIssue(
    {
      name: 'Claiton da silva schimi',
      cpf: '034.268.570-80',
      birthDate: '08/02/1991',
      phone: '51980653799',
    },
    fixedNow,
  )?.field,
  'name',
);
assert.equal(
  signupProfileIssue(
    {
      name: 'Claiton da Silva Schimitz',
      cpf: '034.268.570-80',
      birthDate: '08/02/1991',
      phone: '51980653799',
    },
    fixedNow,
  )?.message,
  SIGNUP_CPF_INVALID_MESSAGE,
);
assert.equal(
  signupProfileIssue(
    {
      name: 'Claiton da Silva Schimitz',
      cpf: '034.268.570-81',
      birthDate: '31/02/1991',
      phone: '51980653799',
    },
    fixedNow,
  )?.message,
  'Informe uma data de nascimento válida.',
);
assert.equal(
  signupProfileIssue(
    {
      name: 'Claiton da Silva Schimitz',
      cpf: '034.268.570-81',
      birthDate: '08/02',
      phone: '51980653799',
    },
    fixedNow,
  )?.message,
  'Informe a data de nascimento no formato DD/MM/AAAA.',
);
assert.equal(
  signupProfileIssue(
    {
      name: 'Claiton da Silva Schimitz',
      cpf: '034.268.570-81',
      birthDate: '08/02/1991',
      phone: '51980653799',
    },
    fixedNow,
  ),
  null,
);
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
assert.ok(registerDto.includes('@IsFullName()'), 'full name rule lives on the DTO');
assert.ok(registerDto.includes('@IsBrazilianMobile()'), 'optional WhatsApp rule lives on the DTO');
assert.ok(registerDto.includes('@IsAdultBirthDate()'), 'age rule lives on the DTO');

const flow = readFileSync(join(__dirname, '../components/account/CreateAccountFlow.tsx'), 'utf8');
assert.ok(flow.includes('data-signup-step="email"'), 'step 1 collects e-mail');
assert.ok(flow.includes('data-signup-step="profile"'), 'step 2 collects personal data');
assert.ok(flow.includes('data-signup-step="access"'), 'step 3 collects password');
assert.ok(flow.includes('Cadastrar e continuar'), 'Portuguese register CTA');
assert.ok(flow.includes('Já tenho conta'), 'path back to login');
assert.ok(flow.includes('Lojas Schimitz'), 'store name on the fixed header');
assert.ok(flow.includes('/privacidade'), 'privacy policy is the existing page');
assert.ok(flow.includes('buildRegisterBody'), 'submit uses the real register payload');
assert.ok(flow.includes('signupProfileIssue'), 'step 2 validates before leaving');
assert.ok(flow.includes('signupAccessIssue'), 'step 3 validates before register');
assert.ok(flow.includes('Passo 3 de 3'), 'signup stays three steps');
assert.ok(flow.includes('SignupProgress'), 'progress shows passo N de 3');
assert.ok(flow.includes('FixedEmail'), 'e-mail stays fixed after step 1');
const submit = flow.slice(flow.indexOf('async function submitAccess'), flow.indexOf('const message'));
assert.ok(submit.includes('signupProfileIssue'), 'password step rechecks personal data before register');
assert.ok(submit.includes('birthDateToIso'), 'display date is converted before register');
assert.ok(submit.indexOf('birthDateToIso') < submit.indexOf('buildRegisterBody'), 'ISO is ready before the register body');
assert.ok(submit.includes('birthDate: birthIso'), 'register payload keeps AAAA-MM-DD');
const emailStep = flow.slice(flow.indexOf('data-signup-step="email"'), flow.indexOf('data-signup-step="profile"'));
assert.ok(emailStep.includes('type="email"'), 'step 1 has the e-mail field');
assert.ok(emailStep.includes('signup-email-error'), 'e-mail conflict is shown on the e-mail field');
assert.equal(emailStep.includes('signup-cpf'), false, 'step 1 does not ask for CPF');
const later = flow.slice(flow.indexOf('data-signup-step="profile"'));
assert.ok(later.includes('data-fixed-email'), 'chosen e-mail is fixed after step 1');
assert.equal(later.includes('type="email"'), false, 'later steps do not ask for e-mail again');
assert.ok(later.includes('signup-cpf'), 'step 2 asks for CPF');
assert.ok(later.includes('CPF'), 'CPF label is Portuguese');
assert.ok(later.includes('Data de nascimento'), 'step 2 asks for birth date');
assert.ok(later.includes('maskCpf'), 'CPF input is masked');
assert.ok(later.includes('signup-cpf-error'), 'CPF conflict is shown on the CPF field');
assert.ok(later.includes('signup-birth'), 'birth date field is present');
const profile = later.slice(0, later.indexOf('data-signup-step="access"'));
assert.equal(profile.includes('type="date"'), false, 'birth date does not open the native calendar');
assert.ok(profile.includes('type="text"'), 'birth date is a text field');
assert.ok(profile.includes('inputMode="numeric"'), 'birth date opens the numeric keyboard');
assert.ok(profile.includes('pattern="[0-9]*"'), 'numeric pattern keeps the mobile keypad');
assert.ok(profile.includes('autoComplete="bday"'), 'birth date stays a birthday field');
assert.ok(profile.includes('enterKeyHint="next"'), 'birth date advances with Próximo');
assert.ok(profile.includes('placeholder="DD/MM/AAAA"'), 'placeholder shows the typed format');
assert.ok(profile.includes('maskBirthDate'), 'birth date is masked while typing');
assert.ok(profile.includes('aria-invalid={Boolean(birthFieldError)'), 'birth date exposes aria-invalid');
assert.ok(profile.includes('signup-name-error'), 'name error sits under the field');
assert.ok(profile.includes('signup-birth-error'), 'birth date error sits under the field');
assert.ok(profile.includes('signup-phone-error'), 'WhatsApp error sits under the field');
assert.ok(profile.includes('disabled={!profileReady || busy}'), 'Continuar stays disabled while passo 2 is invalid');
assert.ok(profile.includes("getElementById('signup-phone')"), 'Próximo moves to WhatsApp');
assert.equal(profile.includes('signup-password'), false, 'password stays on step 3');
const access = later.slice(later.indexOf('data-signup-step="access"'));
assert.ok(access.includes('data-fixed-email'), 'e-mail stays fixed on the password step');
assert.equal(access.includes('type="email"'), false, 'password step does not ask for e-mail');
assert.equal(access.includes('signup-cpf'), false, 'password step does not repeat CPF');
assert.ok(access.includes('Cadastrar e continuar'), 'register happens on the last step');
assert.equal(/localStorage\.setItem\(\s*['"]sch_(access|refresh)/.test(flow), false, 'signup UI does not store JWTs');

const entrar = readFileSync(join(__dirname, '../app/entrar/page.tsx'), 'utf8');
assert.ok(entrar.includes('/auth/register'), 'entrar still registers on the real endpoint');
assert.ok(entrar.includes('/auth/login'), 'Entrar still posts /auth/login');
assert.ok(entrar.includes('saveSession'), 'login still uses the cookie-first session helper');
assert.ok(entrar.includes('finishLogin'), 'register keeps the same session helper as login');
assert.ok(entrar.includes('CreateAccountFlow'), 'entrar register mode is the multi-step flow');
assert.ok(entrar.includes('readRegisterFailure'), 'entrar maps CPF and e-mail conflicts');
assert.ok(entrar.includes('Esqueci minha senha'), 'login recovery stays available');
assert.equal(/localStorage\.setItem\(\s*['"]sch_(access|refresh)/.test(entrar), false, 'entrar does not store JWTs');
const loginTab = entrar.slice(entrar.indexOf("mode === 'login'"), entrar.indexOf('<CreateAccountFlow'));
assert.equal(/cpf|nascimento|birthDate/i.test(loginTab), false, 'Entrar tab stays email and password only');
const registerFn = entrar.slice(entrar.indexOf('async function submitRegister'), entrar.indexOf('\n  return ('));
assert.ok(registerFn.includes('/auth/register'), 'criar conta posts register');
assert.ok(registerFn.includes('finishLogin'), 'criar conta saves the register session');
assert.equal(registerFn.includes('/auth/login'), false, 'criar conta does not ask for a second login');

const cadastro = readFileSync(join(__dirname, '../app/cadastro/page.tsx'), 'utf8');
assert.ok(cadastro.includes('/auth/register'), 'standalone cadastro still posts register');
assert.ok(cadastro.includes('CreateAccountFlow'), 'standalone cadastro uses the same steps');
assert.ok(cadastro.includes('saveSession'), 'cadastro stays logged in after signup');
assert.ok(cadastro.includes('window.location.href'), 'cadastro goes to next or /conta');
assert.ok(cadastro.includes('readRegisterFailure'), 'cadastro maps duplicate CPF and e-mail');
assert.equal(cadastro.includes('Entrar para continuar'), false, 'no login wall after signup');
assert.equal(cadastro.includes('Faça login para continuar'), false);

console.log('signup-flow tests ok');
