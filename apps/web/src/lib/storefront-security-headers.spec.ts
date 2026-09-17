import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildStorefrontCsp,
  CSP_CONNECT_HOSTS,
  CSP_FRAME_HOSTS,
  CSP_SCRIPT_HOSTS,
  STOREFRONT_CSP_HEADER_NAME,
} from './storefront-csp';
import { STOREFRONT_SECURITY_HEADERS } from './storefront-security-headers';

const keys = STOREFRONT_SECURITY_HEADERS.map((h) => h.key);
for (const need of [
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Strict-Transport-Security',
  'Content-Security-Policy',
]) {
  assert.ok(keys.includes(need), `missing ${need}`);
}
assert.equal(
  STOREFRONT_SECURITY_HEADERS.find((h) => h.key === 'X-Frame-Options')?.value,
  'SAMEORIGIN',
);
assert.ok(
  STOREFRONT_SECURITY_HEADERS.find((h) => h.key === 'Strict-Transport-Security')?.value.includes(
    'max-age=',
  ),
);

assert.equal(STOREFRONT_CSP_HEADER_NAME, 'Content-Security-Policy');
assert.equal(
  keys.includes('Content-Security-Policy-Report-Only'),
  false,
  'Phase A ships enforce CSP (careful), not Report-Only',
);

const csp = STOREFRONT_SECURITY_HEADERS.find((h) => h.key === 'Content-Security-Policy')?.value || '';
assert.equal(csp, buildStorefrontCsp());
assert.ok(csp.includes("default-src 'self'"), csp);
assert.ok(csp.includes("object-src 'none'"), csp);
assert.ok(csp.includes("script-src 'self' 'unsafe-inline' 'unsafe-eval'"), 'Next inline/runtime');
assert.ok(csp.includes('https://sdk.mercadopago.com'), 'MP SDK v2');
assert.ok(csp.includes('https://http2.mlstatic.com'), 'Brick chunks / issuer assets');
assert.ok(csp.includes('https://applepay.cdn-apple.com'), 'SDK-referenced Apple Pay script');
assert.ok(csp.includes('https://api.mercadopago.com'), 'MP API connect');
assert.ok(csp.includes('https://api-static.mercadopago.com'), 'Secure Fields static');
assert.ok(csp.includes('https://secure-fields.mercadopago.com'), 'PCI iframes');
assert.ok(csp.includes('https://www.mercadopago.com.br'), 'BR checkout / privacy frames');
assert.ok(csp.includes('https://viacep.com.br'), 'checkout CEP');
assert.ok(csp.includes("img-src 'self' data: blob: https:"), 'product uploads + PIX QR');
assert.ok(csp.includes("font-src 'self' data:"), 'next/font self-host');
assert.ok(csp.includes('http://localhost:3001'), 'local API connect');
assert.ok(!/\bscript-src[^;]*\bhttps:\s*(;|$)/.test(csp), 'script-src must not be blanket https:');

assert.ok(CSP_SCRIPT_HOSTS.includes('https://sdk.mercadopago.com'));
assert.ok(CSP_CONNECT_HOSTS.includes('https://viacep.com.br'));
assert.ok(CSP_FRAME_HOSTS.includes('https://secure-fields.mercadopago.com'));

const brick = readFileSync(join(__dirname, '../components/MercadoPagoCardBrick.tsx'), 'utf8');
assert.ok(brick.includes('sdk.mercadopago.com/js/v2'));
assert.ok(brick.includes('storefront-csp.ts'), 'Brick points at CSP allowlist');

const nextConfig = readFileSync(join(__dirname, '../../next.config.ts'), 'utf8');
assert.ok(nextConfig.includes('STOREFRONT_SECURITY_HEADERS'), 'next.config applies storefront headers');
assert.ok(!nextConfig.includes('Content-Security-Policy-Report-Only'));

console.log('storefront-security-headers tests ok');
