# Teste do app Android no emulador contra produção (09/10/2026)

## Ambiente
- Emulador Android 15 (API 35, `google_apis` x86_64, Pixel 5), app `app-debug.apk` (`com.lojasschimitz.app.debug`, 1.0.12-debug), **sem** `google-services.json`.
- **KVM:** `/dev/kvm` existe e o `-accel-check` diz "usable", mas com aceleração a VM **não executa** (vCPU parado, 0% de CPU, sem saída do kernel). O teste rodou em **emulação por software (TCG)**: boot de 7 a 23 min, system UI com ANRs seguidos e WebView extremamente lento.
- Nenhum login, cadastro, compra ou permissão de notificação concedida. Sem `google-services.json` o app não obtém token FCM (log `fcm getToken unavailable`), então **não** houve POST em `/api/v1/push/tokens` em produção.

## Provado no emulador
| Item | Resultado |
|---|---|
| Instala e abre | ✅ `adb install` OK; a MainActivity abre |
| Pedido de notificação (Android 13+) | ✅ diálogo "Allow Lojas Schimitz to send you notifications?" (`capturas-emulador/e01-pedido-notificacao.png`); negado, o app segue normal |
| Começa a carregar a loja | ✅ barra de progresso dourada do WebView (`e02-carregando-loja.png`); a DevTools do WebView (`webview_devtools_remote`) estava ativa |
| **Bug encontrado:** o renderer do WebView caiu (SIGTRAP no Chromium) e o **app inteiro foi encerrado** (`Render process's crash wasn't handled by all associated webviews, triggering application crash`) | ✅ reproduzido 2x no build antigo |
| **Correção (PR #185):** com `onRenderProcessGone`, o renderer caiu de novo e o **app continuou vivo** (log `SchimitzWebView: renderer gone crashed=true; recreating WebView`, processo do app ativo, sem "has died") | ✅ |

## Provado fora do emulador (estático / navegador headless)
- **URL de produção e HTTPS, não staging:**
  - no código (`HOME_URL = "https://lojasschimitz.com.br"`, allowlist só `lojasschimitz.com.br`/`www`, `usesCleartextTraffic=false`);
  - no APK: as strings do dex têm só `https://lojasschimitz.com.br/api/v1/push/tokens` e `https://www.lojasschimitz.com.br`, e **nenhum** host `railway.app`, staging, localhost ou 10.0.2.2. (As strings `*_NO_FORCE_STAGING` são constantes da biblioteca do Firebase, não URLs.)
- Home, busca, ofertas, departamento, produto e carrinho da loja pública em tamanho de celular, com o User-Agent do app: HTTP 200 (`capturas/`).
- `assetlinks.json` publicado (HTTP 200) com o pacote `com.lojasschimitz.app`.

## NÃO provado no emulador (por causa do renderer do WebView sob emulação por software)
- Página da loja renderizada dentro do app; navegação home → busca → produto.
- Links externos (WhatsApp / Mercado Pago) abrindo no navegador.
- Botão voltar no histórico do WebView.
- Tela sem internet (`offline.html`).
- Rotação: o manifest tem `configChanges=orientation|screenSize`, então a Activity não é recriada e o WebView mantém a página.

Esses comportamentos estão no código (`handleNavigation`, `OnBackPressedCallback`, `showOfflinePage`, `configChanges`), mas **precisam de um teste em aparelho real** ou num emulador com aceleração (Android Studio no computador do Hector).

### Roteiro de 5 minutos para o Hector no celular (sem comprar)
1. Abrir o app: a home da loja carrega e o endereço é lojasschimitz.com.br.
2. Buscar "fone", abrir um produto e voltar com o botão voltar do Android (volta para a busca, depois para a home e só então sai do app).
3. No produto, tocar no WhatsApp: abre o WhatsApp, fora do app.
4. Girar o celular: a página continua a mesma.
5. Ativar o modo avião e puxar a tela para atualizar: aparece a página "sem internet"; desativar e tocar em tentar de novo: volta.
