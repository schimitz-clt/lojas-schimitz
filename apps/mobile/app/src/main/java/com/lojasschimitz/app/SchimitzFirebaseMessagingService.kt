package com.lojasschimitz.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * FCM: token refresh + foreground messages.
 * Background/killed: Play services shows the system tray; tap opens MainActivity
 * (OPEN_STOREFRONT / data extras `link`+`path`).
 * Foreground: we post a local notification — never force-navigate the WebView
 * (checkout / pagamento must not be interrupted).
 */
class SchimitzFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // force skips the resume throttle. Without POST_NOTIFICATIONS the token is
        // kept locally and MainActivity upserts it once the user grants permission.
        PushRegistration.register(applicationContext, token, force = true)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val data = message.data
        val title = message.notification?.title
            ?: data["title"]
            ?: getString(R.string.app_name)
        val body = message.notification?.body
            ?: data["body"]
            ?: getString(R.string.push_default_body)
        val link = PushDeepLink.resolve(data["link"] ?: data["url"], data["path"])
        showPromoNotification(title, body, link)
    }

    private fun showPromoNotification(title: String, body: String, link: String?) {
        ensureChannel()
        val tap = Intent(this, MainActivity::class.java).apply {
            action = PushDeepLink.ACTION_OPEN
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (!link.isNullOrBlank()) {
                putExtra(PushDeepLink.EXTRA_LINK, link)
            }
        }
        val pending = PendingIntent.getActivity(
            this,
            (System.currentTimeMillis() % Int.MAX_VALUE).toInt(),
            tap,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, PushDeepLink.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_splash_mark)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        try {
            NotificationManagerCompat.from(this).notify(
                (System.currentTimeMillis() % Int.MAX_VALUE).toInt(),
                notification,
            )
        } catch (_: SecurityException) {
            // POST_NOTIFICATIONS denied — ignore; background tray still works on older APIs
        }
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = getSystemService(NotificationManager::class.java) ?: return
        val existing = mgr.getNotificationChannel(PushDeepLink.CHANNEL_ID)
        if (existing != null) return
        mgr.createNotificationChannel(
            NotificationChannel(
                PushDeepLink.CHANNEL_ID,
                getString(R.string.push_channel_name),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = getString(R.string.push_channel_desc)
            },
        )
    }
}
