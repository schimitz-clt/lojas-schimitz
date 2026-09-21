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
assert.ok(kotlin.includes('onShowFileChooser'), 'file chooser preserved');
assert.ok(kotlin.includes('CookieManager.getInstance().flush()'), 'cookie flush preserved');
assert.ok(kotlin.includes('mercadopago.com'), 'MP still opens external');
assert.ok(kotlin.includes('PushDeepLink.resolve'), 'tap opens mapped storefront URL');

assert.ok(pushReg.includes('CookieManager.getInstance().getCookie'), 'cookie-first register');
assert.ok(pushReg.includes('/api/v1/push/tokens'), 'token upsert path');
assert.ok(!pushReg.includes('localStorage'), 'no JWT from JS storage');
assert.ok(!pushReg.includes('Authorization'), 'cookie header, not Bearer from storage');

assert.ok(deep.includes('lojasschimitz.com.br'), 'allowed host');
assert.ok(deep.includes('javascript:'), 'rejects javascript: links');
assert.ok(deep.includes('STORE_ORIGIN'), 'canonical origin');

assert.ok(fcm.includes('onMessageReceived'), 'foreground path');
assert.ok(fcm.includes('onNewToken'), 'token refresh');
assert.ok(fcm.includes('FLAG_ACTIVITY_SINGLE_TOP'), 'tap reuses WebView activity');
assert.ok(fcm.includes('never force-navigate') || fcm.includes('checkout'), 'no forced nav in checkout');

assert.ok(gradle.includes('firebase-bom'), 'Firebase BOM');
assert.ok(gradle.includes('firebase-messaging'), 'FCM SDK');
assert.ok(gradle.includes('google-services.json'), 'plugin only if json present');
assert.ok(kotlin.includes('pushDeviceId'), 'WebView can read the device id');
assert.ok(pushReg.includes('sch_push_device'), 'device id cookie for PDP views');
assert.ok(pushReg.includes('KEY_DEVICE_ID'), 'persists API device id');
assert.ok(!pushReg.includes('sch_push_device=$token') && !pushReg.includes('sch_push_device=${token}'), 'cookie is not the FCM token');
assert.ok(gradle.includes('versionCode = 10'), 'version bump for abandoned-view device cookie');

console.log('android-fcm tests ok');
