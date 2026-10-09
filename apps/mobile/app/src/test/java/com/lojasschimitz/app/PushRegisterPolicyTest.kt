package com.lojasschimitz.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** JVM unit test (no device): pure FCM upsert rules. SYNC: apps/web/src/lib/push-register.policy.ts */
class PushRegisterPolicyTest {
    private val now = 10_000_000L

    private fun enqueue(
        force: Boolean = false,
        token: String = "tok-abcdefghijkl",
        lastSuccessToken: String? = "tok-abcdefghijkl",
        lastSuccessMs: Long = now - 1_000L,
        inFlightToken: String? = null,
        inFlightCount: Int = 0,
    ) = PushRegisterPolicy.shouldEnqueue(force, token, lastSuccessToken, lastSuccessMs, now, inFlightToken, inFlightCount)

    @Test fun blankTokenNeverEnqueues() {
        assertFalse(enqueue(token = "   "))
        assertFalse(enqueue(force = true, token = ""))
    }

    @Test fun forceSkipsThrottleAndInFlight() {
        assertTrue(enqueue(force = true, inFlightToken = "tok-abcdefghijkl", inFlightCount = 1))
    }

    @Test fun sameTokenInFlightIsNotDuplicated() {
        assertFalse(enqueue(lastSuccessToken = null, inFlightToken = "tok-abcdefghijkl", inFlightCount = 1))
    }

    @Test fun newTokenOrNoSuccessEnqueues() {
        assertTrue(enqueue(lastSuccessToken = "other"))
        assertTrue(enqueue(lastSuccessMs = 0L))
    }

    @Test fun sameTokenThrottledFor15Minutes() {
        assertFalse(enqueue(lastSuccessMs = now - PushRegisterPolicy.THROTTLE_MS + 1))
        assertTrue(enqueue(lastSuccessMs = now - PushRegisterPolicy.THROTTLE_MS))
    }

    @Test fun backoffIsImmediateThenGrows() {
        assertEquals(0L, PushRegisterPolicy.backoffBeforeAttempt(1))
        assertEquals(2_000L, PushRegisterPolicy.backoffBeforeAttempt(2))
        assertEquals(4_000L, PushRegisterPolicy.backoffBeforeAttempt(3))
        assertEquals(4_000L, PushRegisterPolicy.backoffBeforeAttempt(9))
    }

    @Test fun fingerprintNeverPrintsWholeToken() {
        assertEquals("len=5", PushRegisterPolicy.fingerprint("short"))
        val fp = PushRegisterPolicy.fingerprint("abcdefghijklmnopqrstuvwxyz")
        assertEquals("…stuvwxyz len=26", fp)
        assertFalse(fp.contains("abcdefgh"))
    }
}
