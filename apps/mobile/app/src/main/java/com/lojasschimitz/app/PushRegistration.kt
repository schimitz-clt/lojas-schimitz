package com.lojasschimitz.app

import android.content.Context
import android.webkit.CookieManager
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Registers the FCM token with the Nest API using the same-origin cookie session
 * (`sch_access` / `sch_refresh` via CookieManager). Does not read JWTs from JS storage.
 */
object PushRegistration {
    private const val PREFS = "sch_push"
    private const val KEY_TOKEN = "fcm_token"
    private const val KEY_LAST_MS = "last_register_ms"
    private const val API_PATH = "/api/v1/push/tokens"
    private val io = Executors.newSingleThreadExecutor()

    fun savedToken(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TOKEN, null)

    fun rememberToken(context: Context, token: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TOKEN, token)
            .apply()
    }

    fun register(context: Context, token: String, force: Boolean = false) {
        if (token.isBlank()) return
        rememberToken(context, token)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val last = prefs.getLong(KEY_LAST_MS, 0L)
        val minInterval = TimeUnit.MINUTES.toMillis(15)
        if (!force && last > 0 && System.currentTimeMillis() - last < minInterval) return
        val appContext = context.applicationContext
        io.execute {
            try {
                val url = URL(PushDeepLink.STORE_ORIGIN + API_PATH)
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 15_000
                    readTimeout = 15_000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                    setRequestProperty("Accept", "application/json")
                    val cookies = CookieManager.getInstance().getCookie(PushDeepLink.STORE_ORIGIN)
                    if (!cookies.isNullOrBlank()) {
                        setRequestProperty("Cookie", cookies)
                    }
                }
                val body = JSONObject()
                    .put("token", token)
                    .put("platform", "android")
                    .put("enabled", true)
                    .put("appVersion", BuildConfig.VERSION_NAME)
                    .toString()
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                conn.inputStream.use { it.readBytes() }
                conn.disconnect()
                prefs.edit().putLong(KEY_LAST_MS, System.currentTimeMillis()).apply()
            } catch (_: Exception) {
                try {
                    val url = URL(PushDeepLink.STORE_ORIGIN + API_PATH)
                    val conn = url.openConnection() as HttpURLConnection
                    conn.errorStream?.close()
                    conn.disconnect()
                } catch (_: Exception) {
                    // best-effort; next resume retries
                }
            }
        }
    }

    fun registerSaved(context: Context, force: Boolean = false) {
        val token = savedToken(context) ?: return
        register(context, token, force)
    }
}
