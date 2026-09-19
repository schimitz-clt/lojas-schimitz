import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { summarizeCspReport } from './csp-report';

const legacy = summarizeCspReport({
  'csp-report': {
    'document-uri': 'https://lojasschimitz.com.br/pedidos/abc',
    'violated-directive': 'script-src',
    'effective-directive': 'script-src',
    'blocked-uri': 'https://evil.example/x.js',
    disposition: 'enforce',
    cookie: 'sch_refresh=secret',
  },
});
assert.equal(legacy.length, 1);
assert.equal(legacy[0].documentUri, 'https://lojasschimitz.com.br/pedidos/abc');
assert.equal(legacy[0].blockedUri, 'https://evil.example/x.js');
assert.equal(legacy[0].violatedDirective, 'script-src');
assert.ok(!JSON.stringify(legacy).includes('sch_refresh'));
assert.ok(!JSON.stringify(legacy).includes('secret'));

const reportingApi = summarizeCspReport([
  {
    type: 'csp-violation',
    body: {
      documentURL: 'https://lojasschimitz.com.br/checkout',
      effectiveDirective: 'script-src',
      blockedURL: 'eval',
      disposition: 'report',
    },
  },
]);
assert.equal(reportingApi[0].disposition, 'report');
assert.equal(reportingApi[0].blockedUri, 'eval');

assert.deepEqual(summarizeCspReport(null), []);
assert.deepEqual(summarizeCspReport({ foo: 1 }), []);

const long = 'https://example.com/' + 'a'.repeat(800);
assert.ok(summarizeCspReport({ 'csp-report': { 'document-uri': long } })[0].documentUri.length <= 400);

const ctrl = readFileSync(join(__dirname, 'security.controller.ts'), 'utf8');
assert.ok(ctrl.includes("@Post('csp-report')"));
assert.ok(ctrl.includes('summarizeCspReport'));
assert.ok(ctrl.includes('HttpCode(204)'));
assert.ok(ctrl.includes('Throttle'));

const webCsp = readFileSync(
  join(__dirname, '../../../../web/src/lib/storefront-csp.ts'),
  'utf8',
);
assert.ok(webCsp.includes("/api/v1/security/csp-report"));

const mainTs = readFileSync(join(__dirname, '../../main.ts'), 'utf8');
assert.ok(mainTs.includes('applyHttpBodyParsers'));
assert.ok(mainTs.includes('bodyParser: false'));
assert.ok(mainTs.includes('SecurityModule') === false, 'module is registered in app.module, not main');
const bodyParsers = readFileSync(join(__dirname, '../../common/http-body-parsers.ts'), 'utf8');
assert.ok(bodyParsers.includes("application/csp-report"));
assert.ok(bodyParsers.includes('application/reports+json'));
const appMod = readFileSync(join(__dirname, '../../app.module.ts'), 'utf8');
assert.ok(appMod.includes('SecurityModule'));

console.log('csp-report unit tests ok');
