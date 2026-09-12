# Digital Asset Links (TWA / App Links)

Pacote Android: `com.lojasschimitz.app`

Arquivo servido pelo Next em:

`https://lojasschimitz.com.br/.well-known/assetlinks.json`

Fonte no monorepo: `apps/web/public/.well-known/assetlinks.json`  
(espelho de exemplo: `apps/mobile/assetlinks.example.json`)

## Antes de publicar

1. Obtenha o SHA-256 da chave de **upload** (ou Assinatura do app no Play Console → Integridade do app).
2. Substitua o placeholder `SUBSTITUA_PELO_SHA256_…` no JSON.
3. Faça deploy do `apps/web` para o domínio.
4. Valide: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://lojasschimitz.com.br&relation=delegate_permission/common.handle_all_urls`

O manifesto em `apps/mobile` já declara `intent-filter` com `android:autoVerify="true"`.
