/**
 * RegisterDto exige CPF válido e data de nascimento com 18 anos ou mais.
 * Telefone continua opcional. Senha segue a regra anterior.
 */
import assert from 'assert';
import { validate } from 'class-validator';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CPF_INVALID_MESSAGE } from './cpf';
import { RegisterDto } from './dto';
import { FULL_NAME_GIBBERISH_MESSAGE, FULL_NAME_NUMBERS_MESSAGE, FULL_NAME_SURNAME_MESSAGE } from './full-name';
import { PHONE_INVALID_MESSAGE } from './phone';

function messagesOf(errors: { constraints?: Record<string, string>; property: string }[]): string[] {
  return errors.flatMap((error) => Object.values(error.constraints || {}));
}

function validDto(overrides: Partial<RegisterDto> = {}): RegisterDto {
  const dto = new RegisterDto();
  dto.email = 'cliente@exemplo.com';
  dto.password = 'senha1234';
  dto.name = 'Maria Silva';
  dto.cpf = '529.982.247-25';
  dto.birthDate = '1990-05-15';
  Object.assign(dto, overrides);
  return dto;
}

async function main() {
  const ok = await validate(validDto());
  assert.equal(ok.length, 0, messagesOf(ok).join(' | '));

  const digits = await validate(validDto({ cpf: '11144477735' }));
  assert.equal(digits.length, 0, 'CPF só dígitos entra');

  const noPhone = validDto();
  delete noPhone.phone;
  assert.equal((await validate(noPhone)).length, 0, 'telefone segue opcional');

  const badCpf = messagesOf(await validate(validDto({ cpf: '529.982.247-26' })));
  assert.ok(badCpf.includes(CPF_INVALID_MESSAGE), badCpf.join(' | '));

  const ownerCpf = messagesOf(await validate(validDto({ cpf: '034.268.570-80' })));
  assert.ok(ownerCpf.includes(CPF_INVALID_MESSAGE), ownerCpf.join(' | '));
  assert.equal((await validate(validDto({ cpf: '034.268.570-81' }))).length, 0, 'CPF do repro com dígito certo entra');

  const missingCpf = messagesOf(await validate(validDto({ cpf: '' })));
  assert.ok(missingCpf.includes('Informe seu CPF.'), missingCpf.join(' | '));

  const repeated = messagesOf(await validate(validDto({ cpf: '111.111.111-11' })));
  assert.ok(repeated.includes(CPF_INVALID_MESSAGE), repeated.join(' | '));

  const oneName = messagesOf(await validate(validDto({ name: 'Claiton' })));
  assert.ok(oneName.includes(FULL_NAME_SURNAME_MESSAGE), oneName.join(' | '));
  const digitsName = messagesOf(await validate(validDto({ name: '123 456' })));
  assert.ok(digitsName.includes(FULL_NAME_NUMBERS_MESSAGE), digitsName.join(' | '));
  const truncated = messagesOf(await validate(validDto({ name: 'Claiton da silva schimi' })));
  assert.ok(truncated.includes(FULL_NAME_GIBBERISH_MESSAGE), truncated.join(' | '));
  assert.equal(
    (await validate(validDto({ name: 'Claiton da Silva Schimitz' }))).length,
    0,
    'sobrenome completo entra; a loja não confere identidade',
  );

  const badPhone = messagesOf(await validate(validDto({ phone: '1'.repeat(32) })));
  assert.ok(badPhone.includes(PHONE_INVALID_MESSAGE), badPhone.join(' | '));
  const lettersPhone = messagesOf(await validate(validDto({ phone: 'abc' })));
  assert.ok(lettersPhone.includes(PHONE_INVALID_MESSAGE), lettersPhone.join(' | '));
  assert.equal((await validate(validDto({ phone: '51980653799' }))).length, 0, 'celular do repro entra');
  assert.equal((await validate(validDto({ phone: '(51) 99999-0000' }))).length, 0);

  const underage = messagesOf(await validate(validDto({ birthDate: '2015-01-01' })));
  assert.ok(
    underage.includes('É preciso ter 18 anos ou mais para criar a conta.'),
    underage.join(' | '),
  );

  const badDay = messagesOf(await validate(validDto({ birthDate: '2024-02-31' })));
  assert.ok(badDay.includes('Informe uma data de nascimento válida.'), badDay.join(' | '));

  const brFormat = messagesOf(await validate(validDto({ birthDate: '15/05/1990' })));
  assert.ok(
    brFormat.includes('Informe a data de nascimento no formato AAAA-MM-DD.'),
    brFormat.join(' | '),
  );

  const missingBirth = messagesOf(await validate(validDto({ birthDate: '' })));
  assert.ok(missingBirth.includes('Informe a data de nascimento.'), missingBirth.join(' | '));

  const weak = messagesOf(await validate(validDto({ password: 'somente' })));
  assert.ok(weak.includes('Senha deve ter letras e números'), weak.join(' | '));

  const svc = readFileSync(join(__dirname, 'auth.service.ts'), 'utf8');
  assert.ok(svc.includes('cpf,'), 'register persiste o CPF normalizado');
  assert.ok(svc.includes('birthDate,'), 'register persiste a data de nascimento');
  assert.ok(svc.includes('where: { cpf }'), 'CPF duplicado é consultado');
  assert.ok(svc.includes('registerDuplicateConflict'), 'CPF ou e-mail duplicado vira conflito');
  assert.ok(svc.includes('Este CPF já possui conta') || svc.includes('registerDuplicateConflict'));
  assert.ok(/async register\([\s\S]*throw new ConflictException/.test(svc), 'duplicata responde 409');
  assert.ok(svc.includes('return this.issue('), 'conta nova emite sessão');

  console.log('register dto tests ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
