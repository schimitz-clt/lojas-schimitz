import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_HOME_BANNERS,
  canCreateHomeBanner,
  homeBannerLimitMessage,
  takeHomeBanners,
} from './home-banners';

assert.equal(MAX_HOME_BANNERS, 11);
assert.equal(canCreateHomeBanner(0), true);
assert.equal(canCreateHomeBanner(10), true);
assert.equal(canCreateHomeBanner(11), false);
assert.equal(canCreateHomeBanner(12), false);
assert.deepEqual(
  takeHomeBanners([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
);
assert.deepEqual(takeHomeBanners(null), []);
assert.ok(homeBannerLimitMessage().includes('11'));

const svc = readFileSync(join(__dirname, 'storefront.service.ts'), 'utf8');
assert.ok(svc.includes('take: MAX_HOME_BANNERS'), 'public list caps at 11');
assert.ok(svc.includes('canCreateHomeBanner'), 'create rejects a 12th active banner');
assert.ok(svc.includes('count({ where: { active: true } })'), 'only ACTIVE banners count toward the cap');
assert.ok(svc.includes('$transaction'), 'create counts existing rows atomically');

console.log('storefront home-banners unit tests ok');
