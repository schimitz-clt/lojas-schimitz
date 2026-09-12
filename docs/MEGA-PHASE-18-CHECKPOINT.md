# MEGA Phase 18 — Android WebView audit + closed AAB 1.0.3

**Data:** 2026-09-12 ~20:25 America/Sao_Paulo (UTC-3)  
**Base git:** `ebbcb71` (Phase 17 checkpoint SHA docs).  
**Escopo:** auditoria MainActivity (cookies, 3P/MP, back, SSL, allowlist, offline, deep links); só fixes seguros; AAB assinado 1.0.3 se houver mudança móvel. Sem Play production, sem cobranças.

## FASE / STATUS

| Campo | Valor |
|-------|--------|
| **FASE** | MEGA Phase 18 — Android WebView audit |
| **STATUS** | DONE (hardening + AAB closed 1.0.3; **não** publicado em Play production) |
| **COMMIT** | `fb0089b189c0e5f8d19683ef2ab883db1c171e48` |
| **PRODUÇÃO WEB** | Inalterada nesta fase |
| **RISCOS** | Baixo — CookieManager/SSL explícitos; MP continua no browser externo |
| **BLOQUEIO** | Play production publish + 12 testers + Play App Signing SHA verify |

## Auditoria MainActivity (antes → depois)

| Área | Antes (1.0.2 / versionCode 3) | Depois Phase 18 | Ação |
|------|-------------------------------|-----------------|------|
| **Cookies first-party** | `CookieManager` não configurado (default aceita) | `setAcceptCookie(true)` + `flush()` em `onPause` | **Fix** — sessão cookie-first (`sch_refresh` HttpOnly) no WebView |
| **Third-party cookies / MP** | Não setado (default 3P off em L+) | `setAcceptThirdPartyCookies(webView, false)` | **Explícito off** — PIX/checkout same-origin; hosts MP abrem no navegador |
| **DomStorage** | `domStorageEnabled = true` | Inalterado | OK |
| **Mixed content** | `MIXED_CONTENT_NEVER_ALLOW` | Inalterado | OK |
| **Back button** | `OnBackPressedCallback` + `canGoBack` / offline sai | Inalterado | OK |
| **SSL** | Sem `onReceivedSslError` (default cancela) | `handler.cancel()` + página offline; **nunca** `proceed()` | **Fix** |
| **Cleartext / http** | `usesCleartextTraffic=false` + NSC; `handleNavigation` aceitava http na allowlist | HTTP na allowlist faz upgrade para https; deep links só https | **Fix** |
| **Domain allowlist** | `lojasschimitz.com.br` + `www` | Inalterado | OK |
| **Offline page** | `assets/offline.html` + JS `LojasSchimitz.retry()` | Também em erro SSL | OK + SSL |
| **Deep links** | `autoVerify` https apex/www; `isAllowedUrl` + `onNewIntent` | `isAllowedUrl` exige https | OK |
| **NSC / system CAs** | cleartext false; trust system | Inalterado | OK |
| **applicationId** | `com.lojasschimitz.app` | Inalterado | OK |
| **version** | versionCode 3 / 1.0.2 (closed track) | versionCode **4** / **1.0.3** | Bump (mudança móvel) |

## Feito

| Item | Onde | Nota |
|------|------|------|
| CookieManager + flush | `MainActivity.kt` | First-party on; 3P off; persistência em `onPause` |
| SSL cancel + offline | `MainActivity.kt` | Sem `proceed()` |
| HTTPS-only in-WebView | `handleNavigation` / `isAllowedUrl` | http allowlist → https |
| versionCode 4 / 1.0.3 | `app/build.gradle.kts` | Novo AAB closed |
| README | `apps/mobile/README.md` | targetSdk 36 + notas de cookie/SSL |
| AAB assinado | GitHub release `android-closed-1.0.3` | **Não** enviado à Play Console |
| Docs | este arquivo | BLOQUEIO Play production |

## Upload key SHA-256 (local JKS)

```
CA:9C:14:50:C2:B3:A7:81:15:33:4A:40:26:0D:B8:07:C1:77:05:9F:58:9C:5F:40:0E:64:7D:56:85:9C:3C:5A
```

Já está em `apps/web/public/.well-known/assetlinks.json` (chave de **upload**).

## BLOQUEIO (dono / Play Console)

Não feito nesta fase — exige conta Play do dono:

1. **Play production publish** — não publicar 1.0.3 em produção. Usar só faixa **teste fechado** (closed) se quiser validar o AAB.
2. **12 testers** — completar a lista de testers da faixa fechada (Play exige testers ativos antes de promover).
3. **Play App Signing SHA verify** — em Play Console → Integridade do app, copiar o SHA-256 do **certificado de assinatura do app** (pode diferir da upload key). Se o Play App Signing estiver ativo, **adicionar** esse fingerprint em `assetlinks.json` **sem remover** o da upload key acima. Validar: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://lojasschimitz.com.br&relation=delegate_permission/common.handle_all_urls`

## Explicitamente NÃO feito

- Play Console upload / production / cobrança da taxa  
- Habilitar third-party cookies no WebView  
- `SslErrorHandler.proceed()`  
- Capacitor / TWA / mudança de `applicationId`  
- Cobrança Mercado Pago / alteração do checkout web  
- Rotação da keystore / secrets  

## TESTES

- `./gradlew :app:bundleRelease` em `apps/mobile` com `ANDROID_HOME=/workspace/android-sdk` + `keystore.properties`  
- Artefato: `apps/mobile/app/build/outputs/bundle/release/app-release.aab`  
- SHA-256 do AAB: `f1c6d0a05bd141044326c8238ee3a774af797ddc35d73733f9c66874f54e9eca`

## Arquivos

- `apps/mobile/app/src/main/java/com/lojasschimitz/app/MainActivity.kt`  
- `apps/mobile/app/build.gradle.kts`  
- `apps/mobile/README.md`  
- `docs/MEGA-PHASE-18-CHECKPOINT.md`
