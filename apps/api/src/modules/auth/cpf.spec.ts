import assert from 'assert';
import { cpfError, isValidCpf, normalizeCpf } from './cpf';

assert.equal(normalizeCpf('529.982.247-25'), '52998224725');
assert.equal(normalizeCpf(' 52998224725 '), '52998224725');
assert.equal(isValidCpf('52998224725'), true);
assert.equal(isValidCpf('11144477735'), true);
assert.equal(isValidCpf('52998224726'), false, 'dígito verificador errado');
assert.equal(isValidCpf('11111111111'), false, 'sequência repetida');
assert.equal(isValidCpf('00000000000'), false);
assert.equal(isValidCpf('123'), false);
assert.equal(isValidCpf('529982247251'), false, '12 dígitos não é CPF');

assert.equal(cpfError('529.982.247-25'), null);
assert.equal(cpfError('52998224725'), null);
assert.equal(cpfError(''), 'Informe seu CPF.');
assert.equal(cpfError('   '), 'Informe seu CPF.');
assert.equal(cpfError('529.982.247-26'), 'CPF inválido');
assert.equal(cpfError('111.111.111-11'), 'CPF inválido');
assert.equal(cpfError(52998224725), 'CPF inválido');
assert.equal(cpfError('abc'), 'CPF inválido');
assert.equal(cpfError('5'.repeat(19)), 'CPF inválido');

console.log('cpf unit tests ok');
