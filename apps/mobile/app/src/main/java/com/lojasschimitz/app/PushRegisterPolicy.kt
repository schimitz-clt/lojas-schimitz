package com.lojasschimitz.app

/**
 * Pure rules for FCM upsert scheduling.
 * SYNC: apps/web/src/lib/push-register.policy.ts
 *
 * A mass send only reaches tokens already stored by `POST /api/v1/push/tokens`.
 * These rules make a reinstall upsert that token even when the first call fails,
 * without posting the same token again on every resume.
 */
object PushRegisterPolicy {
    const val MAX_ATTEMPTS = 3
    const val THROTTLE_MS = 15 * 60 * 1000L

    /** Delay before attempt 1, 2, 3. Attempt 1 is immediate. */
    private val BACKOFF_MS = longArrayOf(0L, 2_000L, 4_000L)

    fun backoffBeforeAttempt(attempt: Int): Long {
        if (attempt <= 1) return 0L
        val idx = (attempt - 1).coerceAtMost(BACKOFF_MS.lastIndex)
        return BACKOFF_MS[idx]
    }

    /**
     * @param force permission grant or [SchimitzFirebaseMessagingService.onNewToken]
     * skips the throttle and the in-flight guard.
     */
    fun shouldEnqueue(
        force: Boolean,
        token: String,
        lastSuccessToken: String?,
        lastSuccessMs: Long,
        nowMs: Long,
        inFlightToken: String?,
        inFlightCount: Int,
    ): Boolean {
        val trimmed = token.trim()
        if (trimmed.isEmpty()) return false
        if (force) return true
        if (inFlightCount > 0 && inFlightToken == trimmed) return false
        if (lastSuccessToken != trimmed) return true
        if (lastSuccessMs <= 0L) return true
        return nowMs - lastSuccessMs >= THROTTLE_MS
    }

    /**
     * Log suffix only. Tokens shorter than 12 chars are omitted entirely so a
     * short or empty value can never be printed in full.
     */
    fun fingerprint(token: String): String {
        val trimmed = token.trim()
        if (trimmed.length < 12) return "len=${trimmed.length}"
        return "…${trimmed.takeLast(8)} len=${trimmed.length}"
    }
}
