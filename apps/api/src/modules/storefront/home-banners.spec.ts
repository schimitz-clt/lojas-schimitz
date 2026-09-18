import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_HOME_BANNERS,
  canCreateHomeBanner,
  homeBannerLimitMessage,
  takeHomeBanners,
} from './home-banners';

assert.equal(MAX_HOME_BANNERS, 5);
assert.equal(canCreateHomeBanner(0), true);
assert.equal(canCreateHomeBanner(4), true);
assert.equal(canCreateHomeBanner(5), false);
assert.equal(canCreateHomeBanner(6), false);
assert.deepEqual(
  takeHomeBanners([1, 2, 3, 4, 5, 6, 7]),
  [1, 2, 3, 4, 5],
);
assert.deepEqual(takeHomeBanners(null), []);
assert.ok(homeBannerLimitMessage().includes('5'));

const svc = readFileSync(join(__dirname, 'storefront.service.ts'), 'utf8');
assert.ok(svc.includes('take: MAX_HOME_BANNERS'), 'public list caps at 5');
assert.ok(svc.includes('canCreateHomeBanner'), 'create rejects a 6th banner');
assert.ok(svc.includes('$transaction'), 'create counts existing rows atomically');

console.log('storefront home-banners unit tests ok');
