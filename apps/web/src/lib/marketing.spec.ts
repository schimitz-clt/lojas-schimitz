import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  gaMeasurementId,
  metaPixelId,
  mergeUtm,
  productLandingPath,
  utmFromSearch,
  utmHasValues,
} from './marketing';

{
  const utm = utmFromSearch('?utm_source=meta&utm_medium=cpc&utm_campaign=lancamento&utm_content=<script>&gclid=abc');
  assert.equal(utm.utmSource, 'meta');
  assert.equal(utm.utmMedium, 'cpc');
  assert.equal(utm.utmCampaign, 'lancamento');
  assert.equal(utm.utmContent, 'script');
  assert.equal('gclid' in utm, false);
  assert.equal(utmHasValues({}), false);
  assert.deepEqual(mergeUtm({ utmSource: 'google' }, { utmCampaign: 'b' }), {
    utmSource: 'google',
    utmCampaign: 'b',
  });
}

assert.equal(gaMeasurementId(''), null);
assert.equal(gaMeasurementId('G-TEST'), null);
assert.equal(gaMeasurementId('UA-123456'), null);
assert.equal(gaMeasurementId('G-ABC123XYZ'), 'G-ABC123XYZ');
assert.equal(metaPixelId(''), null);
assert.equal(metaPixelId('PIXEL'), null);
assert.equal(metaPixelId('12345678'), '12345678');
assert.equal(productLandingPath('aura anc'), '/produto/aura%20anc');

{
  const src = readFileSync(join(__dirname, '../components/MarketingPixels.tsx'), 'utf8');
  assert.ok(src.includes('NEXT_PUBLIC_GA_MEASUREMENT_ID'));
  assert.ok(src.includes('NEXT_PUBLIC_META_PIXEL_ID'));
  assert.ok(!/G-[A-Z0-9]{4,}/.test(src.replace('G-[A-Z0-9]', '')), 'pixel component has no baked GA id');
  assert.equal(/\bfbq\('init', '\d+/.test(src), false, 'no baked Meta pixel id');
  assert.ok(src.includes('gaMeasurementId'));
  assert.ok(src.includes('metaPixelId'));
  assert.ok(src.includes('return null'));
}

console.log('marketing unit tests ok');
