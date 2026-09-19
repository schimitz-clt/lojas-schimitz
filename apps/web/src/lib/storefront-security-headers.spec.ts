import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildStorefrontCsp,
  buildStorefrontCspReportOnly,
  CSP_CONNECT_HOSTS,
  CSP_DEV_CONNECT_HOSTS,
  CSP_FRAME_HOSTS,
  CSP_REPORT_PATH,
  CSP_SCRIPT_HOSTS,
  STOREFRONT_CSP_HEADER_NAME,
  STOREFRONT_CSP_REPORT_ONLY_HEADER_NAME,
} from './storefront-csp';
import {
  buildStorefrontSecurityHeaders,
  STOREFRONT_HSTS,
  STOREFRONT_PERMISSIONS_POLICY,
} from './storefront-security-headers';

const prodHeaders = buildStorefrontSecurityHeaders({ production: true });
const devHeaders = buildStorefrontSecurityHeaders({ production: false });
const prodKeys = prodHeaders.map((h) => h.key);

for (const need of [
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Strict-Transport-Security',
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Resource-Policy',
  'X-Permitted-Cross-Domain-Policies',
  'Content-Security-Policy',
  'Content-Security-Policy-Report-Only',
  'Reporting-Endpoints',
]) {
  assert.ok(prodKeys.includes(need), `missing ${need} in production headers`);
}

assert.equal(devHeaders.some((h) => h.key === STOREFRONT_CSP_REPORT_ONLY_HEADER_NAME), false);
assert.equal(devHeaders.some((h) => h.key === 'Reporting-Endpoints'), false);

assert.equal(prodHeaders.find((h) => h.key === 'X-Frame-Options')?.value, 'SAMEORIGIN');
assert.equal(
  prodHeaders.find((h) => h.key === 'Cross-Origin-Opener-Policy')?.value,
  'same-origin-allow-popups',
);
assert.equal(
  prodHeaders.find((h) => h.key === 'Cross-Origin-Resource-Policy')?.value,
  'same-origin',
);
assert.equal(prodHeaders.find((h) => h.key === 'Permissions-Policy')?.value, STOREFRONT_PERMISSIONS_POLICY);
assert.equal(prodHeaders.find((h) => h.key === 'X-Permitted-Cross-Domain-Policies')?.value, 'none');
assert.ok(STOREFRONT_PERMISSIONS_POLICY.includes('camera=()'));
assert.ok(STOREFRONT_PERMISSIONS_POLICY.includes('geolocation=()'));
assert.ok(STOREFRONT_PERMISSIONS_POLICY.includes('browsing-topics=()'));
assert.ok(STOREFRONT_PERMISSIONS_POLICY.includes('usb=()'));
assert.ok(!STOREFRONT_PERMISSIONS_POLICY.includes('payment='), 'do not block MP wallets');
assert.ok(!STOREFRONT_PERMISSIONS_POLICY.includes('clipboard'), 'do not block PIX copia-e-cola');
assert.ok(
  !prodKeys.includes('Cross-Origin-Embedder-Policy'),
  'COEP would break Mercado Pago Brick without CORP on MP CDNs',
);
assert.equal(prodHeaders.find((h) => h.key === 'Strict-Transport-Security')?.value, STOREFRONT_HSTS);
assert.ok(STOREFRONT_HSTS.includes('preload'));

assert.equal(STOREFRONT_CSP_HEADER_NAME, 'Content-Security-Policy');
assert.equal(STOREFRONT_CSP_REPORT_ONLY_HEADER_NAME, 'Content-Security-Policy-Report-Only');

const csp = prodHeaders.find((h) => h.key === 'Content-Security-Policy')?.value || '';
assert.equal(csp, buildStorefrontCsp({ production: true }));
assert.ok(csp.includes("default-src 'self'"), csp);
assert.ok(csp.includes("object-src 'none'"), csp);
assert.ok(csp.includes("script-src 'self' 'unsafe-inline' 'unsafe-eval'"), 'Next inline/runtime');
assert.ok(csp.includes('https://sdk.mercadopago.com'), 'MP SDK v2');
assert.ok(csp.includes('https://js.mercadopago.com'), 'legacy MP JS / security.js');
assert.ok(csp.includes('https://http2.mlstatic.com'), 'Brick chunks / issuer assets');
assert.ok(csp.includes('https://applepay.cdn-apple.com'), 'SDK-referenced Apple Pay script');
assert.ok(csp.includes('https://api.mercadopago.com'), 'MP API connect');
assert.ok(csp.includes('https://api-static.mercadopago.com'), 'Secure Fields static');
assert.ok(csp.includes('https://secure-fields.mercadopago.com'), 'PCI iframes');
assert.ok(csp.includes('https://www.mercadopago.com.br'), 'BR checkout / privacy frames');
assert.ok(csp.includes('https://mercadopago.com'), 'apex MP (wildcard does not cover apex)');
assert.ok(csp.includes('https://viacep.com.br'), 'checkout CEP');
assert.ok(csp.includes("img-src 'self' data: blob: https:"), 'product uploads + PIX QR');
assert.ok(csp.includes("font-src 'self' data:"), 'next/font self-host');
assert.ok(csp.includes('upgrade-insecure-requests'), 'prod HTTPS upgrade');
assert.ok(csp.includes(`report-uri ${CSP_REPORT_PATH}`), 'enforce reports to collector');
assert.ok(!csp.includes('http://localhost'), 'prod enforce must not list localhost');
assert.ok(!csp.includes('ws://localhost'), 'prod enforce must not list local ws');
assert.ok(!/\bscript-src[^;]*\bhttps:\s*(;|$)/.test(csp), 'script-src must not be blanket https:');

const devCsp = buildStorefrontCsp({ production: false });
assert.ok(devCsp.includes('http://localhost:3001'), 'local API connect in dev');
assert.ok(!devCsp.includes('upgrade-insecure-requests'), 'dev stays HTTP-friendly');
for (const host of CSP_DEV_CONNECT_HOSTS) {
  assert.ok(devCsp.includes(host), `dev connect ${host}`);
}

const reportOnly = prodHeaders.find((h) => h.key === STOREFRONT_CSP_REPORT_ONLY_HEADER_NAME)?.value || '';
assert.equal(reportOnly, buildStorefrontCspReportOnly({ production: true }));
assert.ok(reportOnly.includes("script-src 'self' 'unsafe-inline'"), 'report-only keeps inline for Next');
assert.ok(!/script-src[^;]*'unsafe-eval'/.test(reportOnly), 'report-only probes without unsafe-eval');
assert.ok(reportOnly.includes('https://sdk.mercadopago.com'), 'report-only still allows Brick');
assert.ok(reportOnly.includes(`report-uri ${CSP_REPORT_PATH}`));
assert.ok(!reportOnly.includes('http://localhost'), 'report-only is production-shaped');

assert.ok(CSP_SCRIPT_HOSTS.includes('https://sdk.mercadopago.com'));
assert.ok(CSP_SCRIPT_HOSTS.includes('https://js.mercadopago.com'));
assert.ok(CSP_CONNECT_HOSTS.includes('https://viacep.com.br'));
assert.ok(CSP_FRAME_HOSTS.includes('https://secure-fields.mercadopago.com'));

const brick = readFileSync(join(__dirname, '../components/MercadoPagoCardBrick.tsx'), 'utf8');
assert.ok(brick.includes('sdk.mercadopago.com/js/v2'));
assert.ok(brick.includes('storefront-csp.ts'), 'Brick points at CSP allowlist');

const pixPage = readFileSync(join(__dirname, '../app/pedidos/[publicId]/page.tsx'), 'utf8');
assert.ok(pixPage.includes('data:image/png;base64'), 'PIX QR is data: (CSP img-src data:)');
assert.ok(pixPage.includes("import('qrcode')"), 'PIX QR generated same-origin, not MP script');

const nextConfig = readFileSync(join(__dirname, '../../next.config.ts'), 'utf8');
assert.ok(
  nextConfig.includes('buildStorefrontSecurityHeaders') || nextConfig.includes('STOREFRONT_SECURITY_HEADERS'),
  'next.config applies storefront headers',
);

console.log('storefront-security-headers tests ok');
