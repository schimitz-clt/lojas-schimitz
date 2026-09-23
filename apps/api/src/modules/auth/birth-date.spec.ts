import assert from 'assert';
import {
  MAX_SIGNUP_AGE_YEARS,
  MIN_SIGNUP_AGE_YEARS,
  birthDateError,
  birthDateToUtcDate,
  calendarDateInTimeZone,
  completedYears,
} from './birth-date';

const now = new Date('2026-09-23T15:00:00-03:00');

assert.equal(MIN_SIGNUP_AGE_YEARS, 18);
assert.equal(MAX_SIGNUP_AGE_YEARS, 120);
assert.deepEqual(calendarDateInTimeZone(now), { y: 2026, m: 9, d: 23 });
assert.deepEqual(calendarDateInTimeZone(new Date('2026-09-24T02:30:00Z')), { y: 2026, m: 9, d: 23 });
assert.deepEqual(calendarDateInTimeZone(new Date('2026-09-24T03:00:00Z')), { y: 2026, m: 9, d: 24 });

assert.equal(completedYears({ y: 2008, m: 9, d: 23 }, { y: 2026, m: 9, d: 23 }), 18);
assert.equal(completedYears({ y: 2008, m: 9, d: 24 }, { y: 2026, m: 9, d: 23 }), 17);
assert.equal(completedYears({ y: 2000, m: 2, d: 29 }, { y: 2026, m: 2, d: 28 }), 25);

assert.equal(birthDateError('2008-09-23', now), null, 'faz 18 hoje');
assert.equal(birthDateError('2008-09-22', now), null);
assert.equal(birthDateError('1990-05-15', now), null);
assert.equal(birthDateError('2000-02-29', now), null, '29 de fevereiro existe');
assert.equal(birthDateError('1906-09-23', now), null, '120 anos entra');
assert.equal(
  birthDateError('2008-09-24', now),
  'É preciso ter 18 anos ou mais para criar a conta.',
);
assert.equal(birthDateError('2026-09-23', now), 'É preciso ter 18 anos ou mais para criar a conta.');
assert.equal(birthDateError('1905-09-23', now), 'Informe uma data de nascimento válida.');
assert.equal(birthDateError('2024-02-31', now), 'Informe uma data de nascimento válida.');
assert.equal(birthDateError('1900-02-29', now), 'Informe uma data de nascimento válida.');
assert.equal(birthDateError('15/05/1990', now), 'Informe a data de nascimento no formato AAAA-MM-DD.');
assert.equal(birthDateError('1990-5-15', now), 'Informe a data de nascimento no formato AAAA-MM-DD.');
assert.equal(birthDateError('', now), 'Informe a data de nascimento.');
assert.equal(birthDateError('   ', now), 'Informe a data de nascimento.');
assert.equal(birthDateError(null, now), 'Informe a data de nascimento.');

const stored = birthDateToUtcDate('1990-05-15');
assert.equal(stored.toISOString(), '1990-05-15T00:00:00.000Z');
assert.throws(() => birthDateToUtcDate('2024-02-31'));

console.log('birth-date unit tests ok');
