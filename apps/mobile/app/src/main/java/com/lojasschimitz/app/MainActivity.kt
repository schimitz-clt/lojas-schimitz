package com.lojasschimitz.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.SslErrorHandler
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {

    companion object {
        private const val HOME_URL = "https://lojasschimitz.com.br"
        private const val PUSH_LOG = "SchimitzPush"
        private const val OFFLINE_ASSET = "file:///android_asset/offline.html"
        private val ALLOWED_HOSTS = setOf(
            "lojasschimitz.com.br",
            "www.lojasschimitz.com.br",
        )
        // Pagamentos / OAuth no navegador externo — 3P cookies no WebView não são necessários.
        private val EXTERNAL_HOST_HINTS = listOf(
            "mercadopago.com",
            "mercadopago.com.br",
            "www.mercadopago.com",
            "www.mercadopago.com.br",
            "api.mercadopago.com",
            "mpago.la",
            "www.mpago.la",
        )
    }

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private var showingOffline = false
    private var lastRequestedUrl: String = HOME_URL
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var tokenRetry: Runnable? = null

    /**
     * `<input type=file>` inside the storefront/Admin WebView (product/banner photos).
     * Uses SAF / GET_CONTENT — no extra storage permission; does not enable file:// access.
     */
    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePathCallback
            filePathCallback = null
            val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            callback?.onReceiveValue(uris)
        }

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            Log.i(PUSH_LOG, "notification permission result granted=$granted")
            // Grant must upsert now. Denial still stores the token for a later grant.
            obtainFcmToken(force = true)
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        // Accept first-party cookies before WebView inflate so sch_refresh survives restarts.
        CookieManager.getInstance().setAcceptCookie(true)
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        applyDarkGoldSystemBars()

        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        progressBar = findViewById(R.id.progressBar)

        swipeRefresh.setColorSchemeColors(Color.parseColor("#D4AF37"))
        swipeRefresh.setProgressBackgroundColorSchemeColor(Color.parseColor("#1A1A1A"))
        swipeRefresh.setOnRefreshListener { retryLoad() }

        configureWebView()

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (showingOffline) {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                        return
                    }
                    if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            },
        )

        val startUrl = resolveStartUrl(intent)
        lastRequestedUrl = startUrl
        if (savedInstanceState == null) {
            loadStartOrOffline(startUrl)
        } else {
            webView.restoreState(savedInstanceState)
        }
        ensurePushRegistration(requestPermission = true, force = true)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (hasPushExtras(intent)) {
            val target = resolveStartUrl(intent)
            lastRequestedUrl = target
            loadStartOrOffline(target)
            return
        }
        intent.data?.toString()?.takeIf { isAllowedUrl(it) }?.let {
            lastRequestedUrl = it
            loadStartOrOffline(it)
        }
    }

    override fun onStart() {
        super.onStart()
        PushRegistration.ensureDeviceCookie(this)
        ensurePushRegistration(requestPermission = false, force = false)
    }

    override fun onResume() {
        super.onResume()
        ensurePushRegistration(requestPermission = false, force = false)
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onStop() {
        CookieManager.getInstance().flush()
        super.onStop()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        tokenRetry?.let { mainHandler.removeCallbacks(it) }
        tokenRetry = null
        cancelFileChooser()
        webView.destroy()
        super.onDestroy()
    }

    private fun applyDarkGoldSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.statusBarColor = Color.parseColor("#1A1A1A")
        window.navigationBarColor = Color.parseColor("#1A1A1A")
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            // PIX/checkout same-origin; MP hosts abrem no navegador externo.
            setAcceptThirdPartyCookies(webView, false)
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            mediaPlaybackRequiresUserGesture = true
            // Match storefront viewport: no page pinch/double-tap zoom (PDP uses lightbox).
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            userAgentString = "$userAgentString LojasSchimitzApp/${BuildConfig.VERSION_NAME}"
            // file:///android_asset (offline.html) still works with allowFileAccess=false.
            // This flag only gates filesystem URLs (file:///sdcard), which we do not need.
            allowFileAccess = false
            allowContentAccess = true
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = false
        }

        webView.addJavascriptInterface(
            object {
                @JavascriptInterface
                fun retry() {
                    runOnUiThread { retryLoad() }
                }

                /** DeviceFcmToken id for PDP view tracking. Empty when push is not registered. */
                @JavascriptInterface
                fun pushDeviceId(): String = PushRegistration.savedDeviceId(this@MainActivity).orEmpty()
            },
            "LojasSchimitz",
        )

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?,
            ): Boolean {
                return showFileChooser(webView, filePathCallback, fileChooserParams)
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?,
            ): Boolean {
                val uri = request?.url ?: return false
                return handleNavigation(uri)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url.isNullOrBlank()) return false
                return handleNavigation(Uri.parse(url))
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                progressBar.visibility = View.VISIBLE
                if (url != null && !url.startsWith("file:///android_asset/")) {
                    showingOffline = false
                    lastRequestedUrl = url
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
                CookieManager.getInstance().flush()
                PushRegistration.registerSaved(this@MainActivity, force = false)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?,
            ) {
                // Only main-frame failures show the offline page (ignore favicon/XHR).
                if (request?.isForMainFrame == true) {
                    showOfflinePage()
                }
            }

            @Deprecated("Deprecated in Java")
            override fun onReceivedError(
                view: WebView?,
                errorCode: Int,
                description: String?,
                failingUrl: String?,
            ) {
                if (!failingUrl.isNullOrBlank() && !failingUrl.startsWith("file:///")) {
                    showOfflinePage()
                }
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler?,
                error: SslError?,
            ) {
                // Nunca handler.proceed() — cancela certificado inválido.
                handler?.cancel()
                if (view === webView) {
                    showOfflinePage()
                }
            }
        }
    }

    private fun loadStartOrOffline(url: String) {
        if (!hasNetwork()) {
            showOfflinePage()
            return
        }
        showingOffline = false
        webView.loadUrl(url)
    }

    private fun retryLoad() {
        val target = lastRequestedUrl.takeIf { isAllowedUrl(it) } ?: HOME_URL
        loadStartOrOffline(target)
    }

    private fun showOfflinePage() {
        showingOffline = true
        swipeRefresh.isRefreshing = false
        progressBar.visibility = View.GONE
        webView.loadUrl(OFFLINE_ASSET)
    }

    private fun hasNetwork(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return true
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun handleNavigation(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase().orEmpty()
        val host = uri.host?.lowercase().orEmpty()

        // WhatsApp (app ou web)
        if (scheme == "whatsapp" ||
            host == "wa.me" ||
            host == "api.whatsapp.com" ||
            host == "web.whatsapp.com" ||
            host.endsWith("whatsapp.com")
        ) {
            openExternal(uri)
            return true
        }

        // Intents de app (tel, mailto, intent://)
        if (scheme == "tel" || scheme == "mailto" || scheme == "sms" || scheme == "intent") {
            openExternal(uri)
            return true
        }

        // Mercado Pago e hosts de pagamento → navegador externo
        if (EXTERNAL_HOST_HINTS.any { host == it || host.endsWith(".$it") }) {
            openExternal(uri)
            return true
        }

        // Mesma origem HTTPS: fica no WebView
        if (scheme == "https" && isAllowedHost(host)) {
            return false
        }

        // http na allowlist: upgrade para https (cleartext bloqueado)
        if (scheme == "http" && isAllowedHost(host)) {
            val httpsUri = uri.buildUpon().scheme("https").build()
            lastRequestedUrl = httpsUri.toString()
            webView.loadUrl(lastRequestedUrl)
            return true
        }

        // Outros https externos (ex.: redes sociais, mapas) → navegador
        if (scheme == "http" || scheme == "https") {
            openExternal(uri)
            return true
        }

        openExternal(uri)
        return true
    }

    private fun isAllowedHost(host: String): Boolean {
        if (host.isBlank()) return false
        return ALLOWED_HOSTS.any { host == it || host.endsWith(".$it") }
    }

    private fun isAllowedUrl(url: String): Boolean {
        if (!URLUtil.isNetworkUrl(url)) return false
        val parsed = Uri.parse(url)
        val host = parsed.host?.lowercase().orEmpty()
        val scheme = parsed.scheme?.lowercase().orEmpty()
        return scheme == "https" && isAllowedHost(host)
    }

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: ActivityNotFoundException) {
            // Sem app para o scheme — ignora silenciosamente.
        }
    }

    /**
     * Same-origin only: Admin product/banner `<input type=file>` on lojasschimitz.com.br.
     * Cancel the previous callback (WebView requires exactly one onReceiveValue).
     */
    private fun showFileChooser(
        view: WebView?,
        callback: ValueCallback<Array<Uri>>?,
        params: WebChromeClient.FileChooserParams?,
    ): Boolean {
        cancelFileChooser()
        val pageUrl = view?.url ?: if (::webView.isInitialized) webView.url else null
        if (pageUrl.isNullOrBlank() || !isAllowedUrl(pageUrl)) {
            callback?.onReceiveValue(null)
            return true
        }
        filePathCallback = callback
        val intent = try {
            params?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
            }
        } catch (_: Exception) {
            cancelFileChooser()
            return false
        }
        return try {
            fileChooserLauncher.launch(intent)
            true
        } catch (_: ActivityNotFoundException) {
            cancelFileChooser()
            false
        }
    }

    private fun cancelFileChooser() {
        val callback = filePathCallback
        filePathCallback = null
        callback?.onReceiveValue(null)
    }

    private fun hasPushExtras(intent: Intent?): Boolean {
        if (intent == null) return false
        return !intent.getStringExtra(PushDeepLink.EXTRA_LINK).isNullOrBlank() ||
            !intent.getStringExtra(PushDeepLink.EXTRA_PATH).isNullOrBlank() ||
            intent.action == PushDeepLink.ACTION_OPEN
    }

    /**
     * App Links (intent.data) or FCM extras (`link` / `path`). Same-origin HTTPS only.
     * Does not change Mercado Pago / file-chooser / CookieManager behavior.
     */
    private fun resolveStartUrl(intent: Intent?): String {
        intent?.data?.toString()?.takeIf { isAllowedUrl(it) }?.let { return it }
        val fromPush = PushDeepLink.resolve(
            intent?.getStringExtra(PushDeepLink.EXTRA_LINK),
            intent?.getStringExtra(PushDeepLink.EXTRA_PATH),
        )
        if (fromPush != null && isAllowedUrl(fromPush)) return fromPush
        return HOME_URL
    }

    /**
     * Fetch the FCM token on every start/resume. Ask for POST_NOTIFICATIONS only
     * from the first create, and fetch the token *before* that dialog so a kill
     * during the prompt does not drop it. Upsert waits until the permission is granted.
     */
    private fun ensurePushRegistration(requestPermission: Boolean, force: Boolean) {
        val needsRuntimePermission =
            Build.VERSION.SDK_INT >= 33 && !PushRegistration.notificationsAllowed(this)
        if (needsRuntimePermission) {
            obtainFcmToken(force = false)
            if (requestPermission) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            return
        }
        if (!force) {
            PushRegistration.registerSaved(this, force = false)
        }
        obtainFcmToken(force)
    }

    private fun obtainFcmToken(force: Boolean, attempt: Int = 1) {
        if (isDestroyed) return
        tokenRetry?.let { mainHandler.removeCallbacks(it) }
        tokenRetry = null
        val appContext = applicationContext
        try {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                val token = if (task.isSuccessful) task.result?.trim().orEmpty() else ""
                if (token.isEmpty()) {
                    Log.w(
                        PUSH_LOG,
                        "fcm getToken failed attempt=$attempt/${PushRegisterPolicy.MAX_ATTEMPTS}",
                    )
                    if (attempt < PushRegisterPolicy.MAX_ATTEMPTS && !isDestroyed) {
                        scheduleTokenRetry(force, attempt + 1)
                    } else {
                        PushRegistration.registerSaved(appContext, force)
                    }
                    return@addOnCompleteListener
                }
                Log.i(PUSH_LOG, "fcm getToken ok fp=${PushRegisterPolicy.fingerprint(token)}")
                PushRegistration.register(appContext, token, force)
            }
        } catch (_: Exception) {
            // google-services.json / Firebase ausente — WebView segue normal
            Log.w(PUSH_LOG, "fcm getToken unavailable")
            PushRegistration.registerSaved(appContext, force)
        }
    }

    private fun scheduleTokenRetry(force: Boolean, attempt: Int) {
        if (attempt > PushRegisterPolicy.MAX_ATTEMPTS || isDestroyed) return
        tokenRetry?.let { mainHandler.removeCallbacks(it) }
        val task = Runnable {
            if (isDestroyed) return@Runnable
            obtainFcmToken(force, attempt)
        }
        tokenRetry = task
        mainHandler.postDelayed(task, PushRegisterPolicy.backoffBeforeAttempt(attempt))
    }
}
