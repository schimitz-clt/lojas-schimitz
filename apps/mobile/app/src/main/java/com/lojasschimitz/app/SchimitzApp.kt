package com.lojasschimitz.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.google.firebase.FirebaseApp

class SchimitzApp : Application() {
    override fun onCreate() {
        super.onCreate()
        ensurePromoChannel()
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseApp.initializeApp(this)
            }
        } catch (_: Exception) {
            // google-services.json ausente — app continua (WebView + cookies intactos)
        }
    }

    private fun ensurePromoChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = getSystemService(NotificationManager::class.java) ?: return
        if (mgr.getNotificationChannel(PushDeepLink.CHANNEL_ID) != null) return
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
