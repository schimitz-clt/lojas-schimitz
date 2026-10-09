# Como gerar e enviar a versão de release do app Android (passo a passo)

Para o Hector. Linguagem simples. **Nenhuma senha, chave ou arquivo `.jks` vai para o GitHub, para o chat ou para este arquivo.**

---

## 0. Antes de tudo: você já tem uma chave?

O Play Console mostra a versão **1.0.12 (versionCode 13)** em teste fechado. Isso quer dizer que **algum AAB já foi enviado** e, portanto, **já existe uma "chave de upload"** registrada na Google.

1. No Play Console, abra **LOJAS SCHIMITZ → Testar e lançar → Configuração → Integridade do app → Assinatura de apps** (em inglês: *App integrity → App signing*).
2. Lá aparecem dois certificados:
   - **Chave de assinatura do app** (*App signing key*): fica com a **Google** (Play App Signing). Você nunca baixa nem perde essa.
   - **Chave de upload** (*Upload key*): é a **sua**. Ela fica num arquivo `.jks` no seu computador.
3. Anote a impressão digital **SHA-256 da chave de upload** que aparece no Console.

**Se você ainda tem o `.jks` que usou para enviar a 1.0.12:** pule para o passo 2 e use esse mesmo arquivo. Para conferir se é o certo, rode o comando abaixo e compare o SHA-256 com o do Console:
```bash
keytool -list -v -keystore /caminho/lojas-schimitz-upload.jks -alias lojas-schimitz
```
(Ele pede a senha. Digite só no seu terminal.)

**Se perdeu o `.jks` ou a senha:** não tem problema, porque a Google guarda a chave do app. Gere uma chave nova (passo 1) e, na mesma tela, use **"Solicitar redefinição da chave de upload"** (*Request upload key reset*), enviando o certificado `.pem` (passo 1.4). A Google leva alguns dias para aprovar.

---

## 1. Gerar a chave de upload (só se não tiver uma)

Precisa do Java (vem com o Android Studio). No terminal do **seu** computador (não no servidor, nem no Railway):

```bash
keytool -genkeypair -v \
  -keystore lojas-schimitz-upload.jks \
  -alias lojas-schimitz \
  -keyalg RSA -keysize 2048 -validity 10000
```

1. Ele pede uma **senha**. Crie uma senha forte e guarde num gerenciador de senhas (Bitwarden, 1Password, cofre do Google). Ela serve para o arquivo e para a chave.
2. Ele pergunta nome, organização, cidade e país. Pode usar o seu nome, "Lojas Schimitz", "Porto Alegre", "RS", "BR".
3. **Faça backup do arquivo `lojas-schimitz-upload.jks`** em dois lugares seguros, por exemplo um pendrive guardado e um cofre na nuvem com senha. **Não** coloque na pasta do projeto, no GitHub, no WhatsApp ou em e-mail.
4. (Só se for pedir redefinição da chave de upload) exporte o certificado público, que **não** é segredo:
   ```bash
   keytool -export -rfc -keystore lojas-schimitz-upload.jks -alias lojas-schimitz -file upload_certificate.pem
   ```
   e envie o `upload_certificate.pem` na tela de Assinatura de apps do Console.

Alternativa sem terminal: no Android Studio, **Build → Generate Signed App Bundle / APK → Android App Bundle → Create new…** faz a mesma coisa.

---

## 2. Dizer ao projeto onde está a chave (só no seu computador)

O projeto já está pronto para isso: `apps/mobile/app/build.gradle.kts` lê um arquivo `apps/mobile/keystore.properties`, se ele existir. Esse arquivo está no `.gitignore` e **nunca** é enviado ao GitHub.

Crie `apps/mobile/keystore.properties` com:
```properties
storeFile=/caminho/absoluto/lojas-schimitz-upload.jks
storePassword=SUA_SENHA_AQUI
keyAlias=lojas-schimitz
keyPassword=SUA_SENHA_AQUI
```
Confira depois com `git status`: o arquivo **não pode** aparecer na lista para commit.

---

## 3. Aumentar o número da versão

A Google não aceita dois envios com o mesmo `versionCode`. A 1.0.12 já usou o **13**.
**Já feito no `main` (PR #194):** `versionCode = 14` e `versionName = "1.0.13"`. É só gerar o AAB a partir do `main` atual.

> Importante: a correção do PR #185 (o app não fecha mais quando o motor do WebView cai) só chega aos aparelhos num **novo AAB** (versionCode 14 ou maior). A 1.0.12 que está no teste fechado **não** tem essa correção.
> O mesmo vale para o #194: no Android 12 ou anterior, a 1.0.13 pergunta "Receber notificações?" antes de enviar o token. Teste rápido num emulador API 31: instalar, abrir, ver o diálogo. Com "Não, obrigado", nenhuma notificação de campanha chega.

---

## 4. (Opcional, para notificações) Firebase

Sem o `google-services.json`, o app funciona normalmente, mas **não recebe notificações push**. Para ativar:
1. Firebase Console → projeto da loja → app Android `com.lojasschimitz.app` → baixar `google-services.json`.
2. Coloque em `apps/mobile/app/google-services.json`. Também está no `.gitignore`; **não** commite.
3. Detalhes em `docs/PUSH-FCM.md`.

---

## 5. Gerar o AAB assinado

No seu computador, com o Android Studio instalado (JDK 17+ e SDK 36):
```bash
cd apps/mobile
./gradlew :app:bundleRelease
```
O arquivo sai em:
`apps/mobile/app/build/outputs/bundle/release/app-release.aab`

Para conferir que saiu assinado com a sua chave de upload:
```bash
keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab
```
O SHA-256 tem de ser igual ao da **chave de upload** no Console.

> Por que no seu computador e não no CI? Porque a chave de upload é sua e não deve ficar em servidor de terceiros. O CI do GitHub só faz o build **debug** de teste. Se um dia quiser automatizar, dá para guardar a chave como *secret* criptografado do GitHub Actions, mas isso é uma decisão sua e fica para depois.

---

## 6. Enviar para a Google (Play App Signing)

1. Play Console → **LOJAS SCHIMITZ → Testar e lançar**.
2. Enquanto o acesso à **Produção** não for liberado, envie para a faixa que já existe (**Teste fechado**). Quando a Google liberar a Produção, crie a versão em **Produção** (ou promova a versão do teste fechado).
3. **Criar nova versão → Enviar** o `app-release.aab`.
4. A Google assina o app com a **chave de assinatura do app** dela (Play App Signing). Você só assina o upload.
5. Cole as **notas da versão** de `ficha.md`.
6. **Revisar versão → Iniciar lançamento.** Em Produção, comece com lançamento gradual (por exemplo 20%) e aumente depois.

---

## 7. Depois do envio (App Links)

O app abre links de `lojasschimitz.com.br` direto (autoVerify). Para isso funcionar, o site precisa publicar `/.well-known/assetlinks.json` com o **SHA-256 da chave de assinatura do app** (a da Google, na tela de Assinatura de apps), não o da chave de upload. Ver `docs/ANDROID-TWA-ASSETLINKS.md` e `apps/mobile/assetlinks.example.json`. Esse SHA-256 é público (não é segredo) e pode ir no repositório.

Em 09/10/2026 o site **já publica** esse arquivo (HTTP 200), com o pacote `com.lojasschimitz.app` e duas impressões digitais. Só confira se uma delas é a **chave de assinatura do app** que aparece no Console.

---

## Resumo do que é segredo e do que não é

| Item | Segredo? | Onde fica |
|---|---|---|
| `lojas-schimitz-upload.jks` | **Sim** | Seu computador + backups seguros |
| Senha do `.jks` | **Sim** | Gerenciador de senhas |
| `keystore.properties` | **Sim** (tem a senha) | Só em `apps/mobile/` no seu computador (já ignorado pelo git) |
| `google-services.json` | Tratar como privado | `apps/mobile/app/` no seu computador (já ignorado pelo git) |
| SHA-256 dos certificados / `upload_certificate.pem` | Não | Pode compartilhar |
| `app-release.aab` | Não é segredo, mas não precisa ir para o GitHub | Envia no Play Console |
