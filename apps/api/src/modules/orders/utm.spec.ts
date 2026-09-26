import assert from 'node:assert/strict';
import { orderUtmIsEmpty, sanitizeOrderUtm, sanitizeUtmValue } from './utm';

assert.equal(sanitizeUtmValue(undefined, 80), null);
assert.equal(sanitizeUtmValue('  ', 80), null);
assert.equal(sanitizeUtmValue('meta<script>', 80), 'metascript');
assert.equal(sanitizeUtmValue('google', 80), 'google');
assert.equal(sanitizeUtmValue('campanha verão', 20), 'campanha verão');
assert.equal(sanitizeUtmValue('x'.repeat(200), 80)?.length, 80);

{
  const utm = sanitizeOrderUtm({
    utmSource: 'meta',
    utmMedium: 'cpc',
    utmCampaign: 'aura-set',
    utmContent: '',
    utmTerm: 'fone bluetooth',
  });
  assert.equal(utm.utmSource, 'meta');
  assert.equal(utm.utmMedium, 'cpc');
  assert.equal(utm.utmCampaign, 'aura-set');
  assert.equal(utm.utmContent, null);
  assert.equal(utm.utmTerm, 'fone bluetooth');
  assert.equal(orderUtmIsEmpty(utm), false);
}

assert.equal(orderUtmIsEmpty(sanitizeOrderUtm({})), true);
assert.equal(orderUtmIsEmpty(sanitizeOrderUtm(null)), true);

console.log('order utm unit tests ok');
