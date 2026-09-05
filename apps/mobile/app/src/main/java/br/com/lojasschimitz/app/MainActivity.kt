package br.com.lojasschimitz.app

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.URLUtil
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    companion object {
        private const val HOME_URL = "https://lojasschimitz.com.br"
        private val ALLOWED_HOSTS = setOf(
            "lojasschimitz.com.br",
            "www.lojasschimitz.com.br",
        )
        // Pagamentos / OAuth costumam funcionar melhor no navegador externo.
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

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        applyDarkGoldSystemBars()

        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        progressBar = findViewById(R.id.progressBar)

        swipeRefresh.setColorSchemeColors(Color.parseColor("#D4AF37"))
        swipeRefresh.setProgressBackgroundColorSchemeColor(Color.parseColor("#1A1A1A"))
        swipeRefresh.setOnRefreshListener { webView.reload() }

        configureWebView()

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            },
        )

        val startUrl = intent?.data?.toString()?.takeIf { isAllowedUrl(it) } ?: HOME_URL
        if (savedInstanceState == null) {
            webView.loadUrl(startUrl)
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.data?.toString()?.takeIf { isAllowedUrl(it) }?.let { webView.loadUrl(it) }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
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
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            mediaPlaybackRequiresUserGesture = true
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            userAgentString = "$userAgentString LojasSchimitzApp/1.0"
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
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
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
            }
        }
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

        // Mesma origem: fica no WebView
        if ((scheme == "http" || scheme == "https") && isAllowedHost(host)) {
            return false
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
        val host = Uri.parse(url).host?.lowercase().orEmpty()
        return isAllowedHost(host)
    }

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: ActivityNotFoundException) {
            // Sem app para o scheme — ignora silenciosamente.
        }
    }
}
