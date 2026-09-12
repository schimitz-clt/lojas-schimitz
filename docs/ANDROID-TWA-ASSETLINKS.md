# Digital Asset Links (TWA / App Links)

Pacote Android: `com.lojasschimitz.app`

Arquivo servido pelo Next em:

`https://lojasschimitz.com.br/.well-known/assetlinks.json`

Fonte no monorepo: `apps/web/public/.well-known/assetlinks.json`  
(espelho de exemplo: `apps/mobile/assetlinks.example.json`)

## Fingerprint atual

O SHA-256 em `assetlinks.json` é o da **chave de upload** (upload key).

Se o app usar **Play App Signing**, o certificado de assinatura do Play pode exigir um **segundo** fingerprint no array `sha256_cert_fingerprints`. Obtenha-o em Play Console → Integridade do app (App integrity) e adicione-o ao JSON sem remover o da upload key.

## Antes de publicar / após mudar certificados

1. Confirme o SHA-256 da chave de upload (e, se aplicável, o da Assinatura do app no Play Console → Integridade do app).
2. Mantenha `package_name` como `com.lojasschimitz.app`.
3. Faça deploy do `apps/web` para o domínio.
4. Valide: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://lojasschimitz.com.br&relation=delegate_permission/common.handle_all_urls`

O manifesto em `apps/mobile` já declara `intent-filter` com `android:autoVerify="true"`.
