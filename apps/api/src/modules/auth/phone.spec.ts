import assert from 'assert';
import { PHONE_INVALID_MESSAGE, PHONE_TOO_LONG_MESSAGE, brazilianMobileDigits, phoneError } from './phone';

assert.equal(phoneError(undefined), null);
assert.equal(phoneError(null), null);
assert.equal(phoneError(''), null);
assert.equal(phoneError('   '), null);
assert.equal(phoneError('51980653799'), null);
assert.equal(phoneError('(51) 99999-0000'), null);
assert.equal(phoneError('+55 51 98065-3799'), null);
assert.equal(phoneError('5551980653799'), null);
assert.equal(brazilianMobileDigits('51980653799'), '51980653799');
assert.equal(phoneError('abc'), PHONE_INVALID_MESSAGE);
assert.equal(phoneError('123'), PHONE_INVALID_MESSAGE);
assert.equal(phoneError('11111111111'), PHONE_INVALID_MESSAGE);
assert.equal(phoneError('00000000000'), PHONE_INVALID_MESSAGE);
assert.equal(phoneError('5133334444'), PHONE_INVALID_MESSAGE);
assert.equal(phoneError('1'.repeat(32)), PHONE_INVALID_MESSAGE);
assert.equal(phoneError('1'.repeat(33)), PHONE_TOO_LONG_MESSAGE);
assert.equal(phoneError(51980653799), PHONE_INVALID_MESSAGE);

console.log('phone unit tests ok');
