package com.lojasschimitz.app

/**
 * Consentimento para notificações (regras puras, testadas na JVM).
 *
 * Android 13+ (API 33): o pedido do sistema (POST_NOTIFICATIONS) já é o consentimento.
 * Android 12 ou anterior: o sistema não pergunta nada, então o app pergunta uma vez,
 * dentro do app, antes de cadastrar o token no servidor. Sem um "sim", o token fica só
 * no aparelho e nenhuma campanha/lembrete chega a esse aparelho.
 */
object PushConsentPolicy {
    const val RUNTIME_PERMISSION_SDK = 33

    enum class Consent(val stored: String?) {
        UNKNOWN(null),
        GRANTED("granted"),
        DENIED("denied"),
        ;

        companion object {
            fun fromStored(raw: String?): Consent = entries.firstOrNull { it.stored != null && it.stored == raw } ?: UNKNOWN
        }
    }

    /** Pode cadastrar/manter o token ativo no servidor? */
    fun mayRegister(sdk: Int, runtimeGranted: Boolean, systemEnabled: Boolean, consent: Consent): Boolean {
        if (sdk >= RUNTIME_PERMISSION_SDK) return runtimeGranted
        return consent == Consent.GRANTED && systemEnabled
    }

    /** Mostrar a pergunta do app (só Android 12-, só uma vez). */
    fun needsInAppPrompt(sdk: Int, consent: Consent): Boolean =
        sdk < RUNTIME_PERMISSION_SDK && consent == Consent.UNKNOWN

    /**
     * Depois de um "não" no Android 12-, desativar no servidor o token que versões
     * anteriores do app já tinham cadastrado sem perguntar.
     */
    fun shouldDisableOnServer(sdk: Int, consent: Consent, everRegistered: Boolean): Boolean =
        sdk < RUNTIME_PERMISSION_SDK && consent == Consent.DENIED && everRegistered
}
