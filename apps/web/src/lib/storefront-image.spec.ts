import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HOME_BANNER_IMAGE_QUALITY,
  HOME_BANNER_IMAGE_SIZES,
  STOREFRONT_OPTIMIZED_IMAGE_HOSTS,
  storefrontImageUnoptimized,
} from './storefront-image';

assert.equal(HOME_BANNER_IMAGE_QUALITY, 60);
assert.ok(HOME_BANNER_IMAGE_SIZES.includes('100vw'));
assert.ok(HOME_BANNER_IMAGE_SIZES.includes('1280px'));

assert.equal(storefrontImageUnoptimized(''), true);
assert.equal(storefrontImageUnoptimized('/cats/eletro.svg'), true);
assert.equal(storefrontImageUnoptimized('/api/v1/uploads/a.png'), true, 'localhost proxy path is not a public file');
assert.equal(storefrontImageUnoptimized('data:image/png;base64,aaa'), true);
assert.equal(
  storefrontImageUnoptimized('https://lojasschimitz.com.br/api/v1/uploads/a.png'),
  false,
);
assert.equal(
  storefrontImageUnoptimized('https://cdn.example/banner.png'),
  true,
  'unknown hosts are not pulled through the image optimizer',
);
assert.ok(STOREFRONT_OPTIMIZED_IMAGE_HOSTS.includes('lojasschimitz.com.br'));

const cfg = readFileSync(join(__dirname, '../../next.config.ts'), 'utf8');
assert.ok(cfg.includes("formats: ['image/webp']"), 'banners encode to webp, not the source png');
assert.ok(cfg.includes('minimumCacheTTL'), 'optimized variants are cached');
assert.equal(cfg.includes('3840'), false, 'do not generate 3840px variants for a 1280px column');
assert.ok(cfg.includes('lojasschimitz.com.br'), 'optimizer allow-list includes the apex upload host');
assert.equal(cfg.includes("hostname: '**'"), false, 'optimizer is not an open image proxy');

const banners = readFileSync(join(__dirname, '../components/HomeBanners.tsx'), 'utf8');
assert.ok(banners.includes("from 'next/image'"), 'hero uses the image optimizer');
assert.ok(banners.includes('HOME_BANNER_IMAGE_QUALITY'), 'hero quality is the shared constant');
assert.ok(banners.includes('initialBanners'), 'server can paint banners without a client fetch');

const card = readFileSync(join(__dirname, '../components/ProductCard.tsx'), 'utf8');
assert.ok(card.includes("from 'next/image'"), 'product photos are resized');
assert.ok(card.includes('PRODUCT_CARD_IMAGE_SIZES'), 'card sizes stay the shelf widths');

const page = readFileSync(join(__dirname, '../app/page.tsx'), 'utf8');
assert.equal(page.includes("'use client'"), false, 'home renders on the server');
assert.ok(page.includes('fetchStoreData'), 'home reads the live API on the server');
assert.ok(page.includes('/store/banners'), 'banners are fetched with the page');
assert.ok(page.includes('/store/shelves'), 'shelves stay on the live rails endpoint');
assert.ok(page.includes('catalogPromise'), 'catalog does not block the hero');

console.log('storefront-image unit tests ok');
