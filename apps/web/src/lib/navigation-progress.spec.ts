import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  internalAppPath,
  scheduleAfterFirstPaint,
  shouldStartNavigationProgress,
} from './navigation-progress';

const origin = 'https://lojasschimitz.com.br';
const here = { pathname: '/', search: '', hash: '', origin };

const plainClick = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
};

assert.equal(internalAppPath('/produtos?q=tv', origin), '/produtos?q=tv');
assert.equal(internalAppPath('/carrinho#cart-coupon', origin), '/carrinho#cart-coupon');
assert.equal(internalAppPath('https://lojasschimitz.com.br/conta', origin), '/conta');
assert.equal(internalAppPath('https://wa.me/5551996253766', origin), null);
assert.equal(internalAppPath('mailto:a@b.c', origin), null);
assert.equal(internalAppPath('#somente-hash', origin), null);
assert.equal(internalAppPath('/admin/pedidos', origin), null);

assert.equal(
  shouldStartNavigationProgress({
    click: plainClick,
    href: '/produtos',
    target: null,
    download: false,
    current: here,
  }),
  true,
);
assert.equal(
  shouldStartNavigationProgress({
    click: { ...plainClick, metaKey: true },
    href: '/produtos',
    target: null,
    download: false,
    current: here,
  }),
  false,
);
assert.equal(
  shouldStartNavigationProgress({
    click: plainClick,
    href: 'https://wa.me/5551996253766',
    target: '_blank',
    download: false,
    current: here,
  }),
  false,
);
assert.equal(
  shouldStartNavigationProgress({
    click: plainClick,
    href: '/carrinho#cart-coupon',
    target: null,
    download: false,
    current: { pathname: '/carrinho', search: '', hash: '', origin },
  }),
  false,
  'hash-only on the same route does not pretend a page change',
);
assert.equal(
  shouldStartNavigationProgress({
    click: plainClick,
    href: '/produtos',
    target: null,
    download: true,
    current: here,
  }),
  false,
);

assert.equal(typeof scheduleAfterFirstPaint(() => undefined), 'function');

const srcRoot = join(__dirname, '..');
const chrome = readFileSync(join(srcRoot, 'components/StorefrontChrome.tsx'), 'utf8');
assert.ok(chrome.includes('<NavigationProgress />'), 'storefront chrome arms the top progress bar');
assert.ok(chrome.includes("from 'next/link'"), 'footer routes use client navigation');
assert.equal(chrome.includes('<a href="/produtos">'), false, 'footer Produtos is not a full document load');
const adminBlock = chrome.slice(chrome.indexOf('if (isAdmin)'), chrome.indexOf('return ('));
assert.equal(adminBlock.includes('NavigationProgress'), false, 'admin shell does not mount the storefront bar');

const header = readFileSync(join(srcRoot, 'components/Header.tsx'), 'utf8');
assert.ok(header.includes('prefetch={true}'), 'header routes fully prefetch');
const bottom = readFileSync(join(srcRoot, 'components/BottomNav.tsx'), 'utf8');
assert.ok(bottom.includes('prefetch={true}'), 'bottom nav fully prefetches the five tabs');

const pdpLoading = readFileSync(join(srcRoot, 'app/produto/[slug]/loading.tsx'), 'utf8');
assert.ok(pdpLoading.includes('PdpSkeleton'), 'product route shows the existing PDP skeleton immediately');
const depLoading = readFileSync(join(srcRoot, 'app/departamento/[slug]/loading.tsx'), 'utf8');
assert.ok(depLoading.includes('ProductGridSkeleton'), 'department route shows the catalog skeleton immediately');

const pdpPage = readFileSync(join(srcRoot, 'app/produto/[slug]/page.tsx'), 'utf8');
const pdpBody = pdpPage.slice(
  pdpPage.indexOf('export default async function Page'),
  pdpPage.indexOf('async function PdpRelatedSlot'),
);
assert.equal(
  pdpBody.includes('await fetchRelatedCatalogProducts'),
  false,
  'related catalog no longer blocks the product shell',
);
assert.ok(pdpPage.includes('fetchRelatedCatalogProducts'), 'related shelf still comes from the live catalog');
assert.ok(pdpBody.includes('<Suspense'), 'related shelf streams behind the product');

const depPage = readFileSync(join(srcRoot, 'app/departamento/[slug]/page.tsx'), 'utf8');
const depBody = depPage.slice(
  depPage.indexOf('export default async function Page'),
  depPage.indexOf('async function DepartmentJsonLd'),
);
assert.equal(depBody.includes('await fetchCategoryMeta'), false, 'department grid is not blocked on category meta');
assert.ok(depPage.includes('fetchCategoryMeta'), 'breadcrumb still uses the categories API');
assert.ok(depBody.includes('DepartamentoClient'), 'department client stays');

const search = readFileSync(join(srcRoot, 'components/SearchBox.tsx'), 'utf8');
assert.ok(search.includes('router.push'), 'search submit and suggestions stay in the app router');
assert.equal(
  search.includes('window.location.href = href'),
  false,
  'search does not hard-reload the storefront',
);

const css = readFileSync(join(srcRoot, 'app/globals.css'), 'utf8');
assert.ok(css.includes('.nav-progress'), 'progress bar is styled');
assert.ok(/\.nav-progress[\s\S]*transform:/.test(css), 'bar animates on the compositor');
assert.ok(css.includes('prefers-reduced-motion'), 'bar respects reduced motion');

console.log('navigation-progress unit tests ok');
