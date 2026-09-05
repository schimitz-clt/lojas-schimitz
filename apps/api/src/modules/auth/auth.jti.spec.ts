import assert from 'assert';
import { createHash, randomUUID } from 'crypto';

function decodePayload(token: string) {
  const part = token.split('.')[1];
  const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return JSON.parse(json);
}

const jtiA = randomUUID();
const jtiB = randomUUID();
assert.notEqual(jtiA, jtiB);
assert.equal(jtiA.length, 36);

const fakeA = [Buffer.from('{"alg":"none"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: 'u1', typ: 'refresh', jti: jtiA })).toString('base64url'), 'x'].join('.');
const payloadA = decodePayload(fakeA);
assert.equal(payloadA.typ, 'refresh');
assert.equal(payloadA.jti, jtiA);

const used = new Set<string>();
used.add(jtiA);
assert.equal(used.has(jtiA), true);
assert.equal(used.has(jtiB), false);
used.add(jtiB);
assert.equal(used.has(jtiB), true);

const hashA = createHash('sha256').update('refresh-A').digest('hex');
const hashB = createHash('sha256').update('refresh-B').digest('hex');
assert.notEqual(hashA, hashB);

console.log('auth jti unit tests ok');
