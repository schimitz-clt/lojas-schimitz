import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '../../../../apps/mobile');
const kotlin = readFileSync(
  join(root, 'app/src/main/java/com/lojasschimitz/app/MainActivity.kt'),
  'utf8',
);
const pushReg = readFileSync(
  join(root, 'app/src/main/java/com/lojasschimitz/app/PushRegistration.kt'),
  'utf8',
);
const deep = readFileSync(
  join(root, 'app/src/main/java/com/lojasschimitz/app/PushDeepLink.kt'),
  'utf8',
);
const fcm = readFileSync(
  join(root, 'app/src/main/java/com/lojasschimitz/app/SchimitzFirebaseMessagingService.kt'),
  'utf8',
);
const manifest = readFileSync(join(root, 'app/src/main/AndroidManifest.xml'), 'utf8');
const gradle = readFileSync(join(root, 'app/build.gradle.kts'), 'utf8');

assert.ok(manifest.includes('POST_NOTIFICATIONS'), 'Android 13+ notification permission');
assert.ok(manifest.includes('SchimitzFirebaseMessagingService'), 'FCM service registered');
assert.ok(manifest.includes('com.google.firebase.MESSAGING_EVENT'), 'FCM intent filter');
assert.ok(manifest.includes('default_notification_channel_id'), 'default FCM channel');
assert.ok(manifest.includes('lojas_schimitz_promos'), 'channel id matches API');
assert.ok(manifest.includes('android:name=".SchimitzApp"'), 'Application class for channel');
assert.ok(!manifest.includes('READ_EXTERNAL_STORAGE'), 'FCM must not add storage permission');

assert.ok(kotlin.includes('POST_NOTIFICATIONS'), 'runtime permission request');
assert.ok(kotlin.includes('FirebaseMessaging.getInstance()'), 'obtains FCM token');
assert.ok(kotlin.includes('PushRegistration.register'), 'registers token with API');
assert.ok(kotlin.includes('override fun onStart()'), 'refresh on start');
assert.ok(kotlin.includes('override fun onResume()'), 'refresh on resume');
assert.ok(kotlin.includes('ensurePushRegistration(requestPermission = false, force = false)'), 'start/resume are throttled');
assert.ok(kotlin.includes('PushRegistration.registerSaved'), 'open-app refresh can update lastSeen');
const tokenFetch = kotlin.indexOf('obtainFcmToken(force = false)');
const permissionLaunch = kotlin.indexOf('notificationPermissionLauncher.launch');
assert.ok(tokenFetch >= 0 && permissionLaunch > tokenFetch, 'FCM token is fetched before the permission dialog');
assert.ok(kotlin.includes('scheduleTokenRetry'), 'retries getToken when Firebase is not ready');
assert.ok(kotlin.includes('PushRegisterPolicy.MAX_ATTEMPTS'), 'token fetch uses the same attempt budget');
assert.ok(kotlin.includes('onShowFileChooser'), 'file chooser preserved');
assert.ok(kotlin.includes('CookieManager.getInstance().flush()'), 'cookie flush preserved');
assert.ok(kotlin.includes('mercadopago.com'), 'MP still opens external');
assert.ok(kotlin.includes('PushDeepLink.resolve'), 'tap opens mapped storefront URL');

assert.ok(pushReg.includes('CookieManager.getInstance().getCookie'), 'cookie-first register');
assert.ok(pushReg.includes('/api/v1/push/tokens'), 'token upsert path');
assert.ok(!pushReg.includes('localStorage'), 'no JWT from JS storage');
assert.ok(!pushReg.includes('Authorization'), 'cookie header, not Bearer from storage');
assert.ok(pushReg.includes('notificationsAllowed'), 'upsert waits until notifications are allowed');
assert.ok(pushReg.includes('postWithRetry'), 'failed API upsert is retried');
assert.ok(pushReg.includes('PushRegisterPolicy.MAX_ATTEMPTS'), 'retry budget');
assert.ok(pushReg.includes('backoffBeforeAttempt'), 'backoff between attempts');
assert.ok(pushReg.includes('KEY_LAST_TOKEN'), 'throttle is per token');
assert.ok(pushReg.includes('shouldEnqueue'), 'duplicate posts are skipped');
assert.ok(pushReg.includes('.put("enabled", true)'), 'granted device stays enabled for campaigns');
assert.ok(pushReg.includes('rememberToken'), 'token is kept locally before the upsert');
const successIdx = pushReg.indexOf('if (result.ok)');
const lastSeenWrite = pushReg.indexOf('putLong(KEY_LAST_MS');
assert.ok(successIdx >= 0 && lastSeenWrite > successIdx, 'throttle clock starts only after a successful upsert');
for (const line of pushReg.split('\n')) {
  if (!line.includes('Log.')) continue;
  assert.equal(line.includes('$token') || line.includes('${token}'), false, `log must not print the token: ${line.trim()}`);
}

assert.ok(deep.includes('lojasschimitz.com.br'), 'allowed host');
assert.ok(deep.includes('javascript:'), 'rejects javascript: links');
assert.ok(deep.includes('STORE_ORIGIN'), 'canonical origin');

assert.ok(fcm.includes('onMessageReceived'), 'foreground path');
assert.ok(fcm.includes('onNewToken'), 'token refresh');
assert.ok(fcm.includes('PushRegistration.register(applicationContext, token, force = true)'), 'onNewToken still force-registers');
assert.ok(fcm.includes('FLAG_ACTIVITY_SINGLE_TOP'), 'tap reuses WebView activity');
assert.ok(fcm.includes('never force-navigate') || fcm.includes('checkout'), 'no forced nav in checkout');

assert.ok(gradle.includes('firebase-bom'), 'Firebase BOM');
assert.ok(gradle.includes('firebase-messaging'), 'FCM SDK');
assert.ok(gradle.includes('google-services.json'), 'plugin only if json present');
assert.ok(kotlin.includes('pushDeviceId'), 'WebView can read the device id');
assert.ok(pushReg.includes('sch_push_device'), 'device id cookie for PDP views');
assert.ok(pushReg.includes('KEY_DEVICE_ID'), 'persists API device id');
assert.ok(!pushReg.includes('sch_push_device=$token') && !pushReg.includes('sch_push_device=${token}'), 'cookie is not the FCM token');
assert.ok(gradle.includes('versionCode = 11'), 'version bump so Play closed testing picks up FCM retry');
assert.ok(gradle.includes('versionName = "1.0.10"'), 'patch version for the registration fix');

console.log('android-fcm tests ok');
