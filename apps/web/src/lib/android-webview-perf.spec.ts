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
// versão ≥ 1.0.15 (16): a correção do swipe abaixo vale daí em diante (1.0.16 = 17 desliga backup).
assert.ok(Number(/versionCode = (\d+)/.exec(gradle)?.[1]) >= 16, 'versionCode ≥ 16');

// 1.0.15: pull-to-refresh must not steal a sideways swipe (home banner carousel at the top of the page).
const layout = readFileSync(resolve(root, 'src/main/res/layout/activity_main.xml'), 'utf8');
const srl = readFileSync(resolve(root, 'src/main/java/com/lojasschimitz/app/HorizontalAwareSwipeRefreshLayout.kt'), 'utf8');
assert.ok(layout.includes('<com.lojasschimitz.app.HorizontalAwareSwipeRefreshLayout'), 'layout uses the horizontal-aware refresh');
assert.equal(layout.includes('<androidx.swiperefreshlayout.widget.SwipeRefreshLayout'), false, 'stock SRL steals sideways swipes');
assert.ok(/override fun onInterceptTouchEvent/.test(srl) && srl.includes('horizontalGesture'), 'sideways gesture stays with the WebView');
assert.ok(srl.includes('dx > dy'), 'horizontal = X beats Y');
console.log('android-webview-perf.spec OK');
