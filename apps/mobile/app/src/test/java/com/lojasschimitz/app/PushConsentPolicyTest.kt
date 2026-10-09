package com.lojasschimitz.app

import com.lojasschimitz.app.PushConsentPolicy.Consent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** JVM unit test (no device): consentimento de push no Android 12- e 13+. */
class PushConsentPolicyTest {

    @Test
    fun android12AndBelowNeverRegistersWithoutInAppYes() {
        for (sdk in listOf(26, 29, 31, 32)) {
            assertFalse("sdk=$sdk sem resposta", PushConsentPolicy.mayRegister(sdk, runtimeGranted = true, systemEnabled = true, consent = Consent.UNKNOWN))
            assertFalse("sdk=$sdk recusou", PushConsentPolicy.mayRegister(sdk, runtimeGranted = true, systemEnabled = true, consent = Consent.DENIED))
            assertTrue("sdk=$sdk aceitou", PushConsentPolicy.mayRegister(sdk, runtimeGranted = false, systemEnabled = true, consent = Consent.GRANTED))
        }
    }

    @Test
    fun android12AndBelowRespectsSystemToggle() {
        assertFalse(PushConsentPolicy.mayRegister(31, runtimeGranted = true, systemEnabled = false, consent = Consent.GRANTED))
    }

    @Test
    fun android13UsesRuntimePermissionOnly() {
        assertTrue(PushConsentPolicy.mayRegister(33, runtimeGranted = true, systemEnabled = true, consent = Consent.UNKNOWN))
        assertFalse(PushConsentPolicy.mayRegister(34, runtimeGranted = false, systemEnabled = true, consent = Consent.GRANTED))
    }

    @Test
    fun inAppPromptOnlyOnceAndOnlyBelow33() {
        assertTrue(PushConsentPolicy.needsInAppPrompt(32, Consent.UNKNOWN))
        assertFalse(PushConsentPolicy.needsInAppPrompt(32, Consent.GRANTED))
        assertFalse(PushConsentPolicy.needsInAppPrompt(32, Consent.DENIED))
        assertFalse(PushConsentPolicy.needsInAppPrompt(33, Consent.UNKNOWN))
    }

    @Test
    fun declineDisablesPreviouslyRegisteredTokenOnServer() {
        assertTrue(PushConsentPolicy.shouldDisableOnServer(30, Consent.DENIED, everRegistered = true))
        assertFalse(PushConsentPolicy.shouldDisableOnServer(30, Consent.DENIED, everRegistered = false))
        assertFalse(PushConsentPolicy.shouldDisableOnServer(30, Consent.GRANTED, everRegistered = true))
        assertFalse(PushConsentPolicy.shouldDisableOnServer(33, Consent.DENIED, everRegistered = true))
    }

    @Test
    fun storedValuesRoundTrip() {
        assertEquals(Consent.GRANTED, Consent.fromStored("granted"))
        assertEquals(Consent.DENIED, Consent.fromStored("denied"))
        assertEquals(Consent.UNKNOWN, Consent.fromStored(null))
        assertEquals(Consent.UNKNOWN, Consent.fromStored("lixo"))
    }
}
