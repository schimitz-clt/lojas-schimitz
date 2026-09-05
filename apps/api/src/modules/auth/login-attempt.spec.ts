import assert from 'assert';
import { HttpException } from '@nestjs/common';
import { LoginAttemptService } from './login-attempt.service';

const svc = new LoginAttemptService();
const ip = '203.0.113.10';
const email = 'user@example.com';

assert.equal(svc.count(ip, email), 0);
svc.assertAllowed(ip, email);

for (let i = 0; i < LoginAttemptService.MAX_FAILS; i++) {
  svc.recordFailure(ip, email);
}
assert.equal(svc.count(ip, email), LoginAttemptService.MAX_FAILS);

let blocked = false;
try {
  svc.assertAllowed(ip, email);
} catch (e) {
  blocked = e instanceof HttpException && e.getStatus() === 429;
  const body = e instanceof HttpException ? e.getResponse() : null;
  assert.ok(typeof body === 'object' && body && (body as { code: string }).code === 'RATE_LIMITED');
  assert.ok(
    typeof body === 'object' &&
      body &&
      String((body as { message: string }).message).includes('Muitas tentativas'),
  );
}
assert.equal(blocked, true);

svc.clear(ip, email);
assert.equal(svc.count(ip, email), 0);
svc.assertAllowed(ip, email);

// email key alone can trip the limit (different IP)
const otherIp = '198.51.100.2';
for (let i = 0; i < LoginAttemptService.MAX_FAILS; i++) {
  svc.recordFailure(otherIp, email);
}
blocked = false;
try {
  svc.assertAllowed('203.0.113.99', email);
} catch (e) {
  blocked = e instanceof HttpException && e.getStatus() === 429;
}
assert.equal(blocked, true);

console.log('login-attempt unit tests ok');
