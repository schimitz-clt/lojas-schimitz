import assert from 'assert';
import { CPF_INVALID_MESSAGE, cpfError, isValidCpf, normalizeCpf } from './cpf';

assert.equal(normalizeCpf('529.982.247-25'), '52998224725');
assert.equal(normalizeCpf(' 52998224725 '), '52998224725');
assert.equal(isValidCpf('52998224725'), true);
assert.equal(isValidCpf('11144477735'), true);
assert.equal(isValidCpf('52998224726'), false, 'dígito verificador errado');
assert.equal(isValidCpf('11111111111'), false, 'sequência repetida');
assert.equal(isValidCpf('00000000000'), false);
assert.equal(isValidCpf('123'), false);
assert.equal(isValidCpf('529982247251'), false, '12 dígitos não é CPF');
assert.equal(isValidCpf('03426857080'), false, 'dígito do repro do dono');
assert.equal(isValidCpf('03426857081'), true, 'mesmo CPF com dígito certo');

assert.equal(cpfError('529.982.247-25'), null);
assert.equal(cpfError('52998224725'), null);
assert.equal(cpfError('034.268.570-81'), null);
assert.equal(cpfError(''), 'Informe seu CPF.');
assert.equal(cpfError('   '), 'Informe seu CPF.');
assert.equal(cpfError('529.982.247-26'), CPF_INVALID_MESSAGE);
assert.equal(cpfError('034.268.570-80'), CPF_INVALID_MESSAGE);
assert.equal(cpfError('111.111.111-11'), CPF_INVALID_MESSAGE);
assert.equal(cpfError('000.000.000-00'), CPF_INVALID_MESSAGE);
assert.equal(cpfError(52998224725), CPF_INVALID_MESSAGE);
assert.equal(cpfError('abc'), CPF_INVALID_MESSAGE);
assert.equal(cpfError('5'.repeat(19)), CPF_INVALID_MESSAGE);

console.log('cpf unit tests ok');
