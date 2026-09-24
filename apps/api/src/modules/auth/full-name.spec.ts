import assert from 'assert';
import {
  FULL_NAME_GIBBERISH_MESSAGE,
  FULL_NAME_INCOMPLETE_MESSAGE,
  FULL_NAME_LETTERS_MESSAGE,
  FULL_NAME_NUMBERS_MESSAGE,
  FULL_NAME_SURNAME_MESSAGE,
  FULL_NAME_TOO_LONG_MESSAGE,
  fullNameError,
} from './full-name';

assert.equal(fullNameError('Maria Silva'), null);
assert.equal(fullNameError('  Claiton da silva schimi  '), FULL_NAME_GIBBERISH_MESSAGE);
assert.equal(fullNameError('Claiton da Silva Schimitz'), null);
assert.equal(fullNameError('Claiton Schmidt'), null);
assert.equal(fullNameError('Philip Souza'), null);
assert.equal(fullNameError('José da Silva'), null);
assert.equal(fullNameError("D'Avila Souza"), null);
assert.equal(fullNameError('Maria asdf'), FULL_NAME_GIBBERISH_MESSAGE);
assert.equal(fullNameError(''), FULL_NAME_INCOMPLETE_MESSAGE);
assert.equal(fullNameError('   '), FULL_NAME_INCOMPLETE_MESSAGE);
assert.equal(fullNameError('Ana'), FULL_NAME_INCOMPLETE_MESSAGE);
assert.equal(fullNameError('Claiton'), FULL_NAME_SURNAME_MESSAGE);
assert.equal(fullNameError('da Silva'), FULL_NAME_SURNAME_MESSAGE);
assert.equal(fullNameError('123 456'), FULL_NAME_NUMBERS_MESSAGE);
assert.equal(fullNameError('Ana 2Silva'), FULL_NAME_NUMBERS_MESSAGE);
assert.equal(fullNameError('Ana !!'), FULL_NAME_LETTERS_MESSAGE);
assert.equal(fullNameError('A'.repeat(121)), FULL_NAME_TOO_LONG_MESSAGE);
assert.equal(fullNameError(12), FULL_NAME_INCOMPLETE_MESSAGE);

console.log('full-name unit tests ok');
