package com.lojasschimitz.app

/**
 * WebView renderer died (crash or killed by the system for memory). Without handling, Android
 * kills the whole app ("Render process's crash wasn't handled by all associated webviews").
 *
 * Rule: recreate the WebView and reload the last page, but at most [MAX_IN_WINDOW] times in
 * [WINDOW_MS]; past that, show the local offline/error page instead of a crash loop.
 */
object RenderRecoveryPolicy {
    const val MAX_IN_WINDOW = 2
    const val WINDOW_MS = 60_000L

    /** Returns the recent recovery timestamps (inside the window) including [nowMs]. */
    fun record(previous: List<Long>, nowMs: Long): List<Long> =
        previous.filter { nowMs - it in 0 until WINDOW_MS } + nowMs

    /** true = reload the page; false = too many renderer deaths in a row, show offline page. */
    fun shouldReload(recent: List<Long>): Boolean = recent.size <= MAX_IN_WINDOW
}
