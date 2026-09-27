import assert from 'node:assert/strict';
import { maskPii, pathOnly, safeStack } from './redact-pii';

// e-mail / CPF / CNPJ / phone / card
const m = maskPii(
  'user maria.silva+x@gmail.com cpf 123.456.789-09 raw 12345678909 cnpj 12.345.678/0001-95 tel (51) 99876-5432 card 4111 1111 1111 1111',
);
for (const leak of ['maria.silva', 'gmail.com', '123.456.789-09', '12345678909', '12.345.678/0001-95', '99876-5432', '4111 1111']) {
  assert.equal(m.includes(leak), false, `leaked ${leak}: ${m}`);
}
assert.ok(m.includes('[EMAIL]') && m.includes('[CPF]') && m.includes('[CNPJ]') && m.includes('[PHONE]') && m.includes('[CARD]'), m);

// secrets
const s = maskPii(
  'connect postgresql://admin:SuperS3cret@db.internal:5432/app Authorization: Bearer abc.def-ghi ' +
    'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.c2lnbmF0dXJlLXZhbHVl mp APP_USR-1234567890123456-abcdef ' +
    'resend re_AbCdEfGhIjKlMnOp url /x?token=zzz&password=yyy',
);
for (const leak of ['SuperS3cret', 'admin:', 'abc.def-ghi', 'eyJhbGciOiJIUzI1NiJ9', 'APP_USR-1234567890123456', 're_AbCdEfGhIjKlMnOp', 'zzz', 'yyy']) {
  assert.equal(s.includes(leak), false, `leaked ${leak}: ${s}`);
}
assert.ok(s.includes('postgresql://[REDACTED]@db.internal'), s);

// non-PII survives (ids, route, prisma codes, line numbers)
const keep = maskPii('PrismaClientKnownRequestError P2002 on Order cm1abc2def3 at /app/dist/orders.service.js:120:15');
assert.ok(keep.includes('P2002') && keep.includes('cm1abc2def3') && keep.includes(':120:15'), keep);

// bounded
assert.ok(maskPii('a'.repeat(5000), 100).length < 130);
assert.equal(maskPii(undefined), '');
assert.equal(maskPii(null), '');

// stack: masked + frames limited
const e = new Error('lookup failed for joao@example.com');
e.stack = ['Error: lookup failed for joao@example.com', ...Array.from({ length: 40 }, (_, i) => `    at f${i} (/app/x.js:${i}:1)`)].join('\n');
const st = safeStack(e, 10)!;
assert.equal(st.includes('joao@example.com'), false);
assert.equal(st.split('\n').length, 11);
assert.equal(safeStack('not an error'), undefined);

// path only
assert.equal(pathOnly('/api/v1/auth/reset?token=abc&email=a@b.com'), '/api/v1/auth/reset');
assert.equal(pathOnly('/api/v1/orders/cm123#frag'), '/api/v1/orders/cm123');
assert.equal(pathOnly(undefined), '/');

console.log('redact-pii.spec OK');
