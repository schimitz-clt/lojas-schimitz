# Digital Asset Links (TWA / App Links)

Pacote Android: `com.lojasschimitz.app`

Arquivo servido pelo Next em:

`https://lojasschimitz.com.br/.well-known/assetlinks.json`

Fonte no monorepo: `apps/web/public/.well-known/assetlinks.json`  
(espelho de exemplo: `apps/mobile/assetlinks.example.json`)

## Fingerprints atuais

O array `sha256_cert_fingerprints` inclui **os dois** SHA-256:

1. **Chave de upload** (upload key) — manter:
   `CA:9C:14:50:C2:B3:A7:81:15:33:4A:40:26:0D:B8:07:C1:77:05:9F:58:9C:5F:40:0E:64:7D:56:85:9C:3C:5A`
2. **Play App Signing** (classic key / certificado de assinatura do app):
   `48:B5:24:E8:11:0C:2D:10:AE:A8:0D:95:9C:9F:C3:F0:FE:E4:DE:38:99:48:BD:D6:6D:E5:DD:62:E3:61:0D:7C`

Não remova o fingerprint da upload key ao atualizar o da Assinatura do app. Novos certificados vêm de Play Console → Integridade do app (App integrity).

## Antes de publicar / após mudar certificados

1. Confirme o SHA-256 da chave de upload (e, se aplicável, o da Assinatura do app no Play Console → Integridade do app).
2. Mantenha `package_name` como `com.lojasschimitz.app`.
3. Faça deploy do `apps/web` para o domínio.
4. Valide: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://lojasschimitz.com.br&relation=delegate_permission/common.handle_all_urls`

O manifesto em `apps/mobile` já declara `intent-filter` com `android:autoVerify="true"`.
