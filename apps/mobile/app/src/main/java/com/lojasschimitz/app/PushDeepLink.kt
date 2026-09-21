package com.lojasschimitz.app

import android.net.Uri
import android.webkit.URLUtil

/**
 * Map FCM data extras → storefront URL allowed in the WebView.
 * Mirrors API `mapPushDeepLink` (hosts only: lojasschimitz.com.br / www).
 */
object PushDeepLink {
    const val EXTRA_LINK = "link"
    const val EXTRA_PATH = "path"
    const val ACTION_OPEN = "OPEN_STOREFRONT"
    const val CHANNEL_ID = "lojas_schimitz_promos"
    const val STORE_ORIGIN = "https://lojasschimitz.com.br"

    private val ALLOWED_HOSTS = setOf(
        "lojasschimitz.com.br",
        "www.lojasschimitz.com.br",
    )

    fun isAllowedHost(host: String?): Boolean {
        val h = host?.lowercase().orEmpty()
        if (h.isBlank()) return false
        return ALLOWED_HOSTS.any { h == it || h.endsWith(".$it") }
    }

    fun isAllowedUrl(url: String): Boolean {
        if (!URLUtil.isNetworkUrl(url)) return false
        val parsed = Uri.parse(url)
        val host = parsed.host?.lowercase().orEmpty()
        val scheme = parsed.scheme?.lowercase().orEmpty()
        return scheme == "https" && isAllowedHost(host)
    }

    fun resolve(link: String?, path: String?): String? {
        val fromLink = link?.trim().orEmpty()
        if (fromLink.isNotEmpty() && isAllowedUrl(fromLink)) return fromLink
        val rawPath = path?.trim().orEmpty()
        if (rawPath.isEmpty()) return null
        if (rawPath.startsWith("javascript:", ignoreCase = true) ||
            rawPath.startsWith("file:", ignoreCase = true) ||
            rawPath.startsWith("intent:", ignoreCase = true) ||
            rawPath.startsWith("data:", ignoreCase = true)
        ) {
            return null
        }
        val pathPart = if (rawPath.startsWith("/")) rawPath else "/$rawPath"
        val url = "$STORE_ORIGIN$pathPart"
        return url.takeIf { isAllowedUrl(it) }
    }
}
