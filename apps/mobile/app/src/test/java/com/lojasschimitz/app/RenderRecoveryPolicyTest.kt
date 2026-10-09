package com.lojasschimitz.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** JVM unit test: renderer-gone recovery must reload, but never loop forever. */
class RenderRecoveryPolicyTest {
    @Test
    fun firstAndSecondDeathReload() {
        var recent = RenderRecoveryPolicy.record(emptyList(), 1_000L)
        assertTrue(RenderRecoveryPolicy.shouldReload(recent))
        recent = RenderRecoveryPolicy.record(recent, 2_000L)
        assertTrue(RenderRecoveryPolicy.shouldReload(recent))
    }

    @Test
    fun thirdDeathInsideWindowShowsOffline() {
        var recent = emptyList<Long>()
        for (t in listOf(1_000L, 2_000L, 3_000L)) recent = RenderRecoveryPolicy.record(recent, t)
        assertFalse(RenderRecoveryPolicy.shouldReload(recent))
    }

    @Test
    fun oldDeathsExpire() {
        var recent = emptyList<Long>()
        for (t in listOf(1_000L, 2_000L)) recent = RenderRecoveryPolicy.record(recent, t)
        recent = RenderRecoveryPolicy.record(recent, 2_000L + RenderRecoveryPolicy.WINDOW_MS + 1)
        assertEquals(1, recent.size)
        assertTrue(RenderRecoveryPolicy.shouldReload(recent))
    }
}
