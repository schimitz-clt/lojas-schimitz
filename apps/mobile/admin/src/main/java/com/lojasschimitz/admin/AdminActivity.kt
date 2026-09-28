package com.lojasschimitz.admin

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.net.http.SslError
import android.os.Bundle
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
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class AdminActivity : AppCompatActivity() {

    companion object {
        private const val START_URL = "https://lojasschimitz.com.br/admin"
        private const val OFFLINE_ASSET = "file:///android_asset/offline.html"
        private val STORE_HOSTS = setOf("lojasschimitz.com.br", "www.lojasschimitz.com.br")
    }

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private var showingOffline = false
    private var lastUrl: String = START_URL
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePathCallback
            filePathCallback = null
            callback?.onReceiveValue(
                WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data),
            )
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        CookieManager.getInstance().setAcceptCookie(true)
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_admin)

        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        progressBar = findViewById(R.id.progressBar)
        swipeRefresh.setColorSchemeColors(Color.parseColor("#F5C400"))
        swipeRefresh.setProgressBackgroundColorSchemeColor(Color.parseColor("#090909"))
        swipeRefresh.setOnRefreshListener { load(lastUrl) }

        configureWebView()
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (!showingOffline && webView.canGoBack()) webView.goBack()
                    else finish()
                }
            },
        )

        if (savedInstanceState == null) load(START_URL) else webView.restoreState(savedInstanceState)
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        webView.destroy()
        super.onDestroy()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
            userAgentString = "$userAgentString SchimitzAdminApp/${BuildConfig.VERSION_NAME}"
            allowFileAccess = false
            allowContentAccess = true
        }
        webView.addJavascriptInterface(
            object {
                @JavascriptInterface
                fun retry() {
                    runOnUiThread { load(lastUrl) }
                }
            },
            "SchimitzAdmin",
        )
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
            }

            override fun onShowFileChooser(
                webView: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?,
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                val intent = params?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                }
                return try {
                    fileChooserLauncher.launch(intent)
                    true
                } catch (_: ActivityNotFoundException) {
                    filePathCallback = null
                    callback?.onReceiveValue(null)
                    false
                }
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                return leaveApp(uri)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
                if (url != null && !url.startsWith("file:")) {
                    showingOffline = false
                    lastUrl = url
                }
                CookieManager.getInstance().flush()
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?,
            ) {
                if (request?.isForMainFrame == true) showOffline()
            }

            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                handler?.cancel()
                showOffline()
            }
        }
    }

    private fun leaveApp(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme == "tel" || scheme == "mailto" || scheme == "sms" || scheme == "whatsapp") {
            openExternal(uri)
            return true
        }
        if (scheme == "http") {
            val host = uri.host?.lowercase()
            if (host != null && host in STORE_HOSTS) {
                val secure = uri.buildUpon().scheme("https").build()
                webView.loadUrl(secure.toString())
                return true
            }
        }
        val host = uri.host?.lowercase()
        if (scheme == "https" && host != null && host in STORE_HOSTS) return false
        if (scheme == "https") {
            openExternal(uri)
            return true
        }
        return true
    }

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: ActivityNotFoundException) {
            // No handler installed.
        }
    }

    private fun load(url: String) {
        val target = if (URLUtil.isHttpsUrl(url)) url else START_URL
        lastUrl = target
        showingOffline = false
        webView.loadUrl(target)
    }

    private fun showOffline() {
        showingOffline = true
        swipeRefresh.isRefreshing = false
        webView.loadUrl(OFFLINE_ASSET)
    }
}
