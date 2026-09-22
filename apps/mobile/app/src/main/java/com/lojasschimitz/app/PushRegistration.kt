package com.lojasschimitz.app

import android.Manifest
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import android.webkit.CookieManager
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Registers the FCM token with the Nest API using the same-origin cookie session
 * (`sch_access` / `sch_refresh` via CookieManager). Does not read JWTs from JS storage.
 *
 * Upsert is idempotent on the token string and refreshes `lastSeenAt`.
 * The POST runs only when notifications are allowed (Android 13+ grant, or older APIs).
 * Until then the token is kept in prefs so a later grant still upserts.
 */
object PushRegistration {
    private const val TAG = "SchimitzPush"
    private const val PREFS = "sch_push"
    private const val KEY_TOKEN = "fcm_token"
    private const val KEY_DEVICE_ID = "device_id"
    private const val KEY_LAST_MS = "last_register_ms"
    private const val KEY_LAST_TOKEN = "last_register_token"
    private const val API_PATH = "/api/v1/push/tokens"
    private const val DEVICE_COOKIE = "sch_push_device"
    private val DEVICE_ID = Regex(
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
    )
    private val io = Executors.newSingleThreadExecutor()
    private val gate = Any()
    private var inFlightToken: String? = null
    private var inFlightCount = 0

    @Volatile
    private var loggedHold = false

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

    /** Android 13+ requires POST_NOTIFICATIONS. Older APIs may post without a runtime grant. */
    fun notificationsAllowed(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < 33) return true
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
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
        val trimmed = token.trim()
        if (trimmed.isEmpty()) return
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TOKEN, trimmed)
            .apply()
    }

    fun register(context: Context, token: String, force: Boolean = false) {
        val trimmed = token.trim()
        if (trimmed.isEmpty()) return
        rememberToken(context, trimmed)
        if (!notificationsAllowed(context)) {
            if (!loggedHold) {
                loggedHold = true
                Log.i(
                    TAG,
                    "token held until notification permission fp=${PushRegisterPolicy.fingerprint(trimmed)}",
                )
            }
            return
        }
        loggedHold = false
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val enqueue = synchronized(gate) {
            val ok = PushRegisterPolicy.shouldEnqueue(
                force = force,
                token = trimmed,
                lastSuccessToken = prefs.getString(KEY_LAST_TOKEN, null),
                lastSuccessMs = prefs.getLong(KEY_LAST_MS, 0L),
                nowMs = now,
                inFlightToken = inFlightToken,
                inFlightCount = inFlightCount,
            )
            if (ok) {
                inFlightToken = trimmed
                inFlightCount += 1
            }
            ok
        }
        if (!enqueue) {
            Log.d(
                TAG,
                "register skipped throttle/in-flight fp=${PushRegisterPolicy.fingerprint(trimmed)} force=$force",
            )
            return
        }
        io.execute {
            try {
                postWithRetry(trimmed, prefs)
            } finally {
                synchronized(gate) {
                    inFlightCount = (inFlightCount - 1).coerceAtLeast(0)
                    if (inFlightCount == 0) inFlightToken = null
                }
            }
        }
    }

    fun registerSaved(context: Context, force: Boolean = false) {
        ensureDeviceCookie(context)
        val token = savedToken(context) ?: return
        register(context, token, force)
    }

    private fun postWithRetry(token: String, prefs: SharedPreferences) {
        val fp = PushRegisterPolicy.fingerprint(token)
        for (attempt in 1..PushRegisterPolicy.MAX_ATTEMPTS) {
            val wait = PushRegisterPolicy.backoffBeforeAttempt(attempt)
            if (wait > 0L) {
                try {
                    Thread.sleep(wait)
                } catch (_: InterruptedException) {
                    Log.w(TAG, "register interrupted fp=$fp")
                    return
                }
            }
            val result = postOnce(token)
            if (result.ok) {
                val editor = prefs.edit()
                result.deviceId?.let { id ->
                    editor.putString(KEY_DEVICE_ID, id)
                    setDeviceCookie(id)
                }
                editor
                    .putLong(KEY_LAST_MS, System.currentTimeMillis())
                    .putString(KEY_LAST_TOKEN, token)
                    .apply()
                Log.i(
                    TAG,
                    "register ok attempt=$attempt/${PushRegisterPolicy.MAX_ATTEMPTS} http=${result.httpCode} fp=$fp",
                )
                return
            }
            Log.w(
                TAG,
                "register fail attempt=$attempt/${PushRegisterPolicy.MAX_ATTEMPTS} http=${result.httpCode} kind=${result.kind} fp=$fp",
            )
        }
    }

    private data class PostResult(
        val ok: Boolean,
        val httpCode: Int,
        val kind: String,
        val deviceId: String?,
    )

    private fun postOnce(token: String): PostResult {
        var conn: HttpURLConnection? = null
        return try {
            val url = URL(PushDeepLink.STORE_ORIGIN + API_PATH)
            conn = (url.openConnection() as HttpURLConnection).apply {
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
            if (code in 200..299) {
                PostResult(ok = true, httpCode = code, kind = "ok", deviceId = parseDeviceId(raw))
            } else {
                PostResult(ok = false, httpCode = code, kind = "http", deviceId = null)
            }
        } catch (e: Exception) {
            PostResult(ok = false, httpCode = -1, kind = e.javaClass.simpleName, deviceId = null)
        } finally {
            try {
                conn?.disconnect()
            } catch (_: Exception) {
                // ignore
            }
        }
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
