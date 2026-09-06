# apps/mobile — Lojas Schimitz (Android)

Wrapper nativo **Kotlin + WebView** que abre [https://lojasschimitz.com.br](https://lojasschimitz.com.br) no app.

| Campo | Valor |
|---|---|
| Nome | Lojas Schimitz |
| applicationId | `br.com.lojasschimitz.app` |
| minSdk / targetSdk | 24 / 35 |
| Entrada | `MainActivity` (WebView) |

> **Por que não Capacitor/TWA?** Neste monorepo um WebView Kotlin é mais simples (sem `node_modules` no app), mantém Nest/Next intactos e cobre navegação mesma-origem + WhatsApp/Mercado Pago. Capacitor/TWA podem ser avaliados depois se precisarem de plugins JS.

## O que o app faz

- Carrega o site no WebView (HTTPS).
- **Mesma origem** (`lojasschimitz.com.br` / `www`) permanece no app.
- **WhatsApp** (`wa.me`, `whatsapp.com`, scheme `whatsapp:`) abre o app/navegador externo.
- **Mercado Pago** e outros HTTPS externos abrem no navegador do sistema (melhor para pagamento/OAuth).
- `tel:` / `mailto:` / `sms:` externos.
- Status bar / splash escuros com destaque dourado (`#1A1A1A` / `#D4AF37`).
- Ícones placeholder (quadrado dourado) — troque antes de publicar.
- Pull-to-refresh e botão voltar do sistema navegam no histórico do WebView.
- Página offline/erro (`assets/offline.html`) se não houver rede ou a carga principal falhar.

## Pré-requisitos (no seu computador)

1. [Android Studio](https://developer.android.com/studio) (Ladybug+ recomendado) com SDK 35 e JDK 17.
2. Aceitar licenças do SDK.
3. (Opcional) Emulador ou aparelho com USB debugging.

Este ambiente de CI/agente **não** tem Android SDK completo — o build final é local no Android Studio / Gradle.

## Abrir no Android Studio

```bash
cd apps/mobile
# Copie e ajuste o caminho do SDK:
cp local.properties.example local.properties
# Abra a pasta apps/mobile no Android Studio (Open).
```

Ou pela CLI (com `ANDROID_HOME` / `local.properties` configurados):

```bash
cd apps/mobile
./gradlew :app:assembleDebug
```

APK debug: `app/build/outputs/apk/debug/app-debug.apk`
(applicationId debug: `br.com.lojasschimitz.app.debug`)

## Build release (AAB para Play Store)

### 1. Gerar keystore (uma vez — guarde com segurança)

```bash
keytool -genkey -v -keystore lojas-schimitz-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias lojas-schimitz
```

**Nunca** commit o `.jks`, a senha ou `keystore.properties` neste repositório.

### 2. Assinar o release

Crie `apps/mobile/keystore.properties` (já no `.gitignore`):

```properties
storeFile=/caminho/absoluto/lojas-schimitz-upload.jks
storePassword=****
keyAlias=lojas-schimitz
keyPassword=****
```

Depois ligue o `signingConfigs` no `app/build.gradle.kts` (bloco `android { ... }`), por exemplo:

```kotlin
val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = java.util.Properties()
if (keystorePropsFile.exists()) {
    keystoreProps.load(keystorePropsFile.inputStream())
}

android {
    // ...
    signingConfigs {
        create("release") {
            if (keystorePropsFile.exists()) {
                storeFile = file(keystoreProps["storeFile"] as String)
                storePassword = keystoreProps["storePassword"] as String
                keyAlias = keystoreProps["keyAlias"] as String
                keyPassword = keystoreProps["keyPassword"] as String
            }
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            // ...
        }
    }
}
```

### 3. Gerar o AAB assinado (Play)

Com `keystore.properties` no lugar:

```bash
cd apps/mobile
./gradlew :app:bundleRelease
```

Artefato (envie este arquivo na Play Console):

`apps/mobile/app/build/outputs/bundle/release/app-release.aab`

Sem keystore o Gradle ainda gera o bundle, mas **não** assinado para upload — configure o passo 2.

Alternativa GUI: Android Studio → **Build → Generate Signed Bundle / APK** → Android App Bundle → release.

> A publicação na Play Console (e a verificação da conta Google) fica com você — este repo só entrega o projeto e o AAB local.

## Quem publica?

**Você (dono da conta Play Console) publica.** Nós só entregamos o código/scaffold — **não** fazemos upload do AAB na Play Store.

## Checklist Google Play Console

1. Criar conta de desenvolvedor (taxa única **US$ 25**).
2. Criar app **Lojas Schimitz**, pacote `br.com.lojasschimitz.app`.
3. Upload do **AAB** assinado (produção ou teste interno primeiro).
4. Ficha da loja: título, descrição curta/longa, ícone 512×512, feature graphic.
5. **Screenshots** (telefone; tablet se declarar suporte).
6. **Política de privacidade**: URL pública apontando para o site (ex.: `https://lojasschimitz.com.br/privacidade` ou página equivalente). Sem política, a Play rejeita.
7. **Classificação de conteúdo** (questionário IARC).
8. Público-alvo / segurança de dados (Data safety form).
9. Categorias, contato, países de distribuição.
10. Enviar para revisão.

## Digital Asset Links (opcional, App Links)

Para o deep link `https://lojasschimitz.com.br/...` abrir o app com verificação automática:

1. Obter o SHA-256 da chave de **upload** / **assinatura do app** no Play Console (Integridade do app).
2. Publicar no site:

`https://lojasschimitz.com.br/.well-known/assetlinks.json`

Exemplo (troque o fingerprint):

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "br.com.lojasschimitz.app",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:…:FF"
      ]
    }
  }
]
```

O manifesto já declara `intent-filter` com `android:autoVerify="true"` para o host.

Stub no site (Next `public`): `apps/web/public/.well-known/assetlinks.json`  
→ servido em `https://lojasschimitz.com.br/.well-known/assetlinks.json`  
Detalhes: `docs/ANDROID-TWA-ASSETLINKS.md`.

## Estrutura

```
apps/mobile/
  app/src/main/java/.../MainActivity.kt
  app/src/main/res/          # tema escuro/dourado, splash, ícones placeholder
  app/build.gradle.kts
  README.md                  # este arquivo
```

## Segurança

- Sem cleartext HTTP.
- Sem keystores/senhas no Git.
- Não altere `apps/api` ou `apps/web` a partir deste módulo.

## Troubleshooting

| Problema | Sugestão |
|---|---|
| `SDK location not found` | Crie `local.properties` a partir do example |
| Página em branco | Confirme rede / certificado HTTPS do site |
| Pagamento falha no WebView | Esperado: Mercado Pago abre no navegador externo |
| WhatsApp não abre | Instale o WhatsApp ou use o fallback do navegador |
