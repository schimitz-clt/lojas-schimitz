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
    private const val KEY_DEVICE_ID = "device_id"
    private const val KEY_LAST_MS = "last_register_ms"
    private const val API_PATH = "/api/v1/push/tokens"
    private const val DEVICE_COOKIE = "sch_push_device"
    private val DEVICE_ID = Regex(
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
    )
    private val io = Executors.newSingleThreadExecutor()

    fun savedToken(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TOKEN, null)

    /** DeviceFcmToken id returned by the API. Not the FCM token. */
    fun savedDeviceId(context: Context): String? {
        val id = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_DEVICE_ID, null)
            ?.trim()
            .orEmpty()
        return id.takeIf { DEVICE_ID.matches(it) }
    }

    /**
     * First-party cookie so the storefront PDP can record a view.
     * Value is the device id only — never the FCM registration token, never sch_access/sch_refresh.
     */
    fun ensureDeviceCookie(context: Context) {
        val id = savedDeviceId(context) ?: return
        setDeviceCookie(id)
    }

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
                val code = conn.responseCode
                val raw = (if (code in 200..299) conn.inputStream else conn.errorStream)
                    ?.bufferedReader(Charsets.UTF_8)
                    ?.use { it.readText() }
                    .orEmpty()
                conn.disconnect()
                if (code in 200..299) {
                    parseDeviceId(raw)?.let { id ->
                        prefs.edit().putString(KEY_DEVICE_ID, id).apply()
                        setDeviceCookie(id)
                    }
                    prefs.edit().putLong(KEY_LAST_MS, System.currentTimeMillis()).apply()
                }
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
        ensureDeviceCookie(context)
        val token = savedToken(context) ?: return
        register(context, token, force)
    }

    private fun parseDeviceId(raw: String): String? {
        return try {
            val id = JSONObject(raw).optJSONObject("data")?.optString("id", "")?.trim().orEmpty()
            id.takeIf { DEVICE_ID.matches(it) }
        } catch (_: Exception) {
            null
        }
    }

    private fun setDeviceCookie(deviceId: String) {
        if (!DEVICE_ID.matches(deviceId)) return
        val cm = CookieManager.getInstance()
        cm.setAcceptCookie(true)
        val value = "$DEVICE_COOKIE=$deviceId; Path=/; Secure; SameSite=Lax; Max-Age=31536000"
        cm.setCookie(PushDeepLink.STORE_ORIGIN, value)
        cm.setCookie("https://www.lojasschimitz.com.br", value)
        cm.flush()
    }
}
