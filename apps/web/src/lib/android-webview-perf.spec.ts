import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../../mobile/app');
const kotlin = readFileSync(resolve(root, 'src/main/java/com/lojasschimitz/app/MainActivity.kt'), 'utf8');
const push = readFileSync(resolve(root, 'src/main/java/com/lojasschimitz/app/PushRegistration.kt'), 'utf8');
const gradle = readFileSync(resolve(root, 'build.gradle.kts'), 'utf8');

const pageFinished = kotlin.slice(kotlin.indexOf('override fun onPageFinished'), kotlin.indexOf('override fun onReceivedError'));
assert.ok(/cookieFlusher\.execute \{ CookieManager\.getInstance\(\)\.flush\(\) \}/.test(pageFinished), 'flush runs off the UI thread');
assert.equal(/^\s*CookieManager\.getInstance\(\)\.flush\(\)\s*$/m.test(pageFinished), false, 'no blocking flush in onPageFinished');
assert.ok(pageFinished.includes('flushCookies = false'), 'device cookie does not flush again on UI thread');
assert.ok(/if \(flush\) cm\.flush\(\)/.test(push), 'setDeviceCookie flush is optional');
assert.ok(kotlin.includes('offscreenPreRaster = true'), 'offscreen pre-raster on');
assert.ok(kotlin.includes('window.setBackgroundDrawable(null)'), 'splash window background removed (overdraw)');
assert.equal(/setLayerType\([^)]*SOFTWARE/.test(kotlin), false, 'no software layer');
assert.equal(/LOAD_NO_CACHE|clearCache\(/.test(kotlin), false, 'HTTP cache kept');
assert.ok(/versionCode = 15/.test(gradle) && /versionName = "1\.0\.14"/.test(gradle), '1.0.14 (15)');
console.log('android-webview-perf.spec OK');
