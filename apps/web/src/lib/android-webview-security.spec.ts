import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';

const kotlin = readFileSync(
  join(__dirname, '../../../../apps/mobile/app/src/main/java/com/lojasschimitz/app/MainActivity.kt'),
  'utf8',
);
const manifest = readFileSync(
  join(__dirname, '../../../../apps/mobile/app/src/main/AndroidManifest.xml'),
  'utf8',
);

assert.ok(/allowFileAccess\s*=\s*false/.test(kotlin), 'WebView must not allow file:/// filesystem access');
assert.ok(/allowFileAccessFromFileURLs\s*=\s*false/.test(kotlin), 'file URL → file URL access off');
assert.ok(/setAcceptThirdPartyCookies\(\s*webView,\s*false\s*\)/.test(kotlin), '3P cookies off');
assert.ok(kotlin.includes('MIXED_CONTENT_NEVER_ALLOW'), 'mixed content never allow');
assert.ok(kotlin.includes('file:///android_asset/offline.html'), 'offline page still uses android_asset');
assert.ok(kotlin.includes('mercadopago.com'), 'MP hosts listed for external browser');
assert.ok(manifest.includes('usesCleartextTraffic="false"'), 'cleartext off');

console.log('android-webview-security tests ok');
