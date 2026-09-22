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
assert.ok(
  kotlin.indexOf('CookieManager.getInstance().setAcceptCookie(true)') < kotlin.indexOf('setContentView'),
  'accept first-party cookies before WebView inflate',
);
assert.ok(/override fun onStop\(\)[\s\S]*CookieManager\.getInstance\(\)\.flush\(\)/.test(kotlin), 'flush cookies onStop');
assert.ok(/override fun onPageFinished[\s\S]*CookieManager\.getInstance\(\)\.flush\(\)/.test(kotlin), 'flush cookies after page load');
assert.ok(kotlin.includes('MIXED_CONTENT_NEVER_ALLOW'), 'mixed content never allow');
assert.ok(kotlin.includes('file:///android_asset/offline.html'), 'offline page still uses android_asset');
assert.ok(kotlin.includes('mercadopago.com'), 'MP hosts listed for external browser');
assert.ok(kotlin.includes('onShowFileChooser'), 'WebView file chooser for <input type=file>');
assert.ok(kotlin.includes('FileChooserParams.parseResult'), 'file chooser uses Activity result');
assert.ok(kotlin.includes('isAllowedUrl(pageUrl)'), 'file chooser stays same-origin');
assert.ok(!/allowFileAccess\s*=\s*true/.test(kotlin), 'file chooser must not re-enable file:// access');
assert.ok(manifest.includes('usesCleartextTraffic="false"'), 'cleartext off');
assert.ok(manifest.includes('android.intent.action.GET_CONTENT'), 'manifest queries GET_CONTENT for picker');
assert.ok(!manifest.includes('READ_EXTERNAL_STORAGE'), 'no broad storage permission for file chooser');
assert.ok(!manifest.includes('READ_MEDIA_IMAGES'), 'no READ_MEDIA_IMAGES — SAF picker only');
assert.ok(
  /LojasSchimitzApp\/\$\{BuildConfig\.VERSION_NAME\}/.test(kotlin),
  'WebView UA uses BuildConfig.VERSION_NAME',
);
assert.equal(kotlin.includes('LojasSchimitzApp/1.0.3'), false, 'UA is not hardcoded 1.0.3');

console.log('android-webview-security tests ok');
