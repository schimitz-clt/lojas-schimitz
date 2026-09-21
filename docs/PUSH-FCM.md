# Push FCM — Lojas Schimitz

Promoções no **app Android** (`com.lojasschimitz.app`) via Firebase Cloud Messaging.
Admin → **Notificações** cria, envia e agenda campanhas. A página Conta `/notificacoes` continua sendo o histórico **in-app** de pedidos (tabela `Notification`) — não foi removida.

**Este PR não faz deploy em produção e não mergeia sozinho.** Push real no telefone exige o dono colar credenciais Firebase + `google-services.json` + um aparelho de teste.

---

## Phase 0 — auditoria (o que já existia)

| Área | Já existia | Lacuna |
|------|------------|--------|
| Android `MainActivity` | WebView same-origin, `CookieManager` first-party **antes** do inflate, flush onStop/onPageFinished, 3P cookies off, MP no navegador externo, file chooser SAF, deep links App Links | Sem FCM, sem `POST_NOTIFICATIONS`, sem registro de token |
| API `Notification` | In-app (pedido pago / status) + e-mail loja. `GET/POST /notifications` | **Não** é FCM. Não reutilizamos essa tabela para campanhas |
| Prisma | Sem `DeviceFcmToken` / `PushCampaign` | Modelos novos **aditivos** (`20260921_push_fcm_campaigns`) |
| Admin | Seções ops…equipe. Sem console de push | Nova seção `/admin/notificacoes` |
| Conta → Notificações | Sino + `/notificacoes` in-app | Mantido |
| Jobs | `SchedulerLock` + `setInterval` (`expireReservations`, MP OAuth refresh) | Reutilizado para campanhas agendadas (`pushCampaignDispatch`) |
| Auth | Cookie-first `sch_access` / `sch_refresh` no WebView | Token FCM enviado com `Cookie` do `CookieManager` (mesmo origin `/api/v1`) |
| Firebase | Ausente | Código completo; envio live = **NÃO EXECUTADO** até secrets |

Checkout, Mercado Pago, pedidos, estoque e auth **não** foram alterados neste lote.

---

## O que o v1 faz

1. App pede permissão de notificação (Android 13+), obtém token FCM, faz upsert em `POST /api/v1/push/tokens`.
2. Logado: `userId` vinculado. Visitante: `userId` nulo (token único mesmo assim).
3. Admin cria campanha (título, texto, imagem HTTPS opcional, rota da loja, público, agora ou agenda).
4. Nest envia via Firebase Admin SDK. Histórico: enviados / falhas / `NÃO EXECUTADO`.
5. Toque na notificação abre a rota da vitrine **dentro do WebView** (hosts `lojasschimitz.com.br` / `www` apenas).

### Públicos (v1) — honesto

| Audience | Significado |
|----------|-------------|
| `all_enabled` | Todos os tokens `enabled=true` (logados **e** visitantes que aceitaram push) |
| `with_orders` | Tokens ativos cujo `userId` tem **pelo menos um pedido** que não é `draft` nem `cancelled` |

Não há segmento VIP, cidade ou “abandonou sacola” nas campanhas manuais. Recuperação de PDP (viu e não comprou) é um job automático à parte — ver abaixo. `with_token` = o mesmo que `all_enabled` (só existe token se o aparelho registrou).

---

## Secrets que o dono precisa adicionar (antes de evidência live)

**Nunca commitar estes valores.**

### Railway — serviço **API** (não o web)

| Variável | Obrigatória | O que é |
|----------|-------------|----------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **Sim** (ou a de baixo) | JSON inteiro da conta de serviço Firebase (uma linha ou multiline) |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Alternativa | Mesmo JSON em Base64 (útil se o painel quebra quebras de linha da private key) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Alternativa local | Path de arquivo; pouco útil no Railway |
| `FIREBASE_PROJECT_ID` | Opcional | Hint; o JSON já traz `project_id` |

Sem essas variáveis: `GET /health` → `fcmConfigured: false`. Campanhas gravam no banco com status `failed` e texto **`NÃO EXECUTADO: Firebase Admin não configurado`**. CI não envia push de verdade.

### App Android (máquina do dono / Play)

| Arquivo | Onde |
|---------|------|
| `google-services.json` **real** | `apps/mobile/app/google-services.json` (gitignored) |
| Exemplo | `apps/mobile/app/google-services.json.example` |

No Firebase Console: projeto Android package `com.lojasschimitz.app`. Inclua também `com.lojasschimitz.app.debug` no mesmo JSON (ou um client extra) para o build debug.

Depois: gerar AAB **1.0.8** (`versionCode` 9) e publicar na Play (teste interno). Sem o JSON o Gradle **não** aplica o plugin `google-services`; o app ainda abre o WebView.

---

## Checklist Firebase (dono)

1. Firebase Console → criar/usar projeto (ex. Lojas Schimitz).
2. Add app Android: `com.lojasschimitz.app`. Baixar `google-services.json` → colar em `apps/mobile/app/`.
3. Cloud Messaging API habilitada.
4. Project settings → Service accounts → Generate new private key. Colar o JSON em `FIREBASE_SERVICE_ACCOUNT_JSON` no Railway **API**.
5. Rebuild API (Railway) para ler o env. Não é necessário mexer em MP / JWT / `DATABASE_URL`.
6. `prisma migrate deploy` (já no `start` da API) aplica `20260921_push_fcm_campaigns`.
7. Instalar o APK/AAB novo no telefone, abrir o app, aceitar notificações, entrar na conta.
8. Admin → Notificações → deve listar o aparelho → **Enviar teste**.

---

## Como verificar (plano de teste)

Pré-requisito: secrets acima + aparelho físico (emulador FCM é instável).

| Estado do app | O que fazer | Esperado |
|---------------|-------------|----------|
| **Aberto (foreground)** | Admin envia teste | Notificação do sistema (não troca a página do WebView sozinha — não interrompe checkout). Toque abre o `link`/`path` no WebView. |
| **Background** (home, app vivo) | Enviar | Bandeja do sistema. Toque → `MainActivity` `singleTask` carrega a URL. |
| **Killed** | Forçar parada, enviar | Play services entrega; toque abre o app na rota. |
| Sem Firebase no Railway | Enviar campanha | Histórico: **NÃO EXECUTADO**, `skippedCount` > 0, nenhum “enviado” falso. |
| Cookie / login | Entrar no app, depois push | Token `userBound: true`. Visitante permanece nulo até o login (upsert reatacha). |

Deep links permitidos: `/`, `/produto/slug`, `/c/...`, `https://lojasschimitz.com.br/...`. Bloqueados: `javascript:`, `file:`, hosts de pagamento, HTTP.

Não teste Mercado Pago / estoque neste lote além de um smoke: abrir sacola e um produto depois do tap.

---

## API

Envelope `{ ok, data }`. Cookie `sch_access` ou Bearer.

| Método | Rota | Acesso |
|--------|------|--------|
| POST | `/push/tokens` `{ token, platform?: "android", enabled?, appVersion? }` | JWT **opcional** |
| GET | `/admin/push/status` | admin |
| GET | `/admin/push/tokens` | admin (sem token completo) |
| GET | `/admin/push/campaigns` | admin |
| GET | `/admin/push/campaigns/:id` | admin + últimos dispatches (fingerprint) |
| POST | `/admin/push/campaigns` | admin — agora ou `scheduledAt` |
| POST | `/admin/push/campaigns/:id/cancel` | admin (só agendada) |
| POST | `/admin/push/campaigns/:id/send` | admin (disparo manual de agendada) |
| POST | `/admin/push/test` `{ tokenId, title?, body?, linkPath? }` | admin — 1 aparelho |
| GET | `/health` | `fcmConfigured` boolean (presença de env, sem segredo) |

Job: a cada 30s, lease `SchedulerLock` id `pushCampaignDispatch`, dispara `status=scheduled` com `scheduledAt <= now`.

---

## Banco (aditivo)

- `DeviceFcmToken` — `token` unique, `userId` nullable, `enabled`, `platform=android`, `lastSeenAt`
- `PushCampaign` — título, body, imageUrl, linkPath, audience, schedule, status, contagens, `errorSummary`
- `PushDispatch` — `tokenFingerprint` (últimos 12 chars), nunca o token inteiro

Sem DROP em `Notification`, `Order`, `Payment`, `Inventory`, `User` (só relações novas).

---

## Arquivos-chave

- Android: `SchimitzFirebaseMessagingService`, `PushRegistration` (CookieManager), `PushDeepLink`
- API: `apps/api/src/modules/push/`
- Admin: `/admin/notificacoes`
- Migration: `prisma/migrations/20260921_push_fcm_campaigns`

---

## Recuperação de produto (viu e não comprou)

Job automático, separado das campanhas do Admin. Um aparelho com token FCM já registrado abre a PDP e, se não compra aquele produto, recebe **um** push.

| Regra | Valor |
|-------|--------|
| Atraso | **2 horas** depois da **última** visita daquele aparelho àquele produto (nova visita reinicia o timer) |
| Público | Só `DeviceFcmToken` `enabled`. Sem id de aparelho a API não grava nada e **não inventa** token |
| Texto | PT-BR: nome do produto, preço no PIX (5% sobre o preço de lista) e “Estamos aguardando. Lojas Schimitz agradece.” |
| Link | `/produto/<slug>` (mesmo deep link das campanhas) |
| Limites | 1 envio por (aparelho, produto) a cada **7 dias**; 1 envio por aparelho por **dia** em `America/Sao_Paulo`. Enquanto o limite vale, a visita espera (`deferUntil`) e pode sair no dia seguinte se ainda tiver menos de 48h |
| Compra | Não envia se, depois da visita, existe pedido daquele usuário (o da visita ou o vinculado ao aparelho) com o produto, status diferente de `draft`/`cancelled`, **ou** pagamento `approved`. Pedido de visitante sem `userId` não dá para ligar ao aparelho |
| Estoque | Produto `active` e quantidade disponível > 0. Fora isso, a visita é encerrada sem envio |
| Idade | Visita com mais de 48h (`ABANDONED_VIEW_MAX_AGE_HOURS`) é encerrada sem envio |
| Firebase ausente | **NÃO EXECUTADO**: não marca como enviado e não gasta o limite de 7 dias. O job tenta de novo quando as credenciais existirem, desde que a visita ainda esteja dentro da idade máxima |

Env (só API, opcional): `ABANDONED_VIEW_DELAY_HOURS` (padrão `2`, mínimo efetivo 1 minuto). **Não** baixe isso em produção. Em staging, `0.0167` ≈ 1 minuto.

O app grava o id do aparelho (não o token FCM) no cookie `sch_push_device` e em `LojasSchimitz.pushDeviceId()`. A PDP chama `POST /api/v1/push/product-views`. Cookies `sch_access` / `sch_refresh` não mudam. APK anterior ao `versionCode` 10 não envia esse id — a vitrine então não registra a visita.

Admin → Notificações mostra um texto fixo e `GET /admin/push/abandoned-views` (contagem, **não envia**).

### Como verificar sem esperar em produção

1. Confirme o aparelho em Admin → Notificações (token ativo) **depois** de instalar o build com `versionCode` 10.
2. Abra um produto no app. No banco:

```sql
SELECT "deviceId", "productId", "userId", "lastViewedAt", "handledViewAt"
FROM "ProductViewEvent"
ORDER BY "lastViewedAt" DESC
LIMIT 20;
```

3. Dry-run (não dispara): `GET /api/v1/admin/push/abandoned-views` como admin. `dueViews` é a fila bruta; o job ainda aplica compra, estoque e limites na hora de enviar.
4. Deixe o atraso padrão de 2h. Só em staging, se quiser encurtar: `ABANDONED_VIEW_DELAY_HOURS=0.0167` no serviço API e reinicie. Não use isso em produção.
5. Com Firebase configurado, o job (mesmo lease das campanhas, a cada 30s) envia e grava `AbandonedViewPush` com `status=sent`. Sem Firebase, nada é marcado como enviado.
6. Compre o produto (pedido real, não `draft`/`cancelled`) antes do atraso: a linha ganha `handledViewAt` e não sai push.

## Fora de escopo / NÃO EXECUTADO neste agente

- Push live de recuperação em telefone físico (depende de Firebase do dono + APK `versionCode` 10 instalado; este ambiente não publica na Play)
- Publicação Play Console
- iOS
- Segmentos de campanha além de `all_enabled` / `with_orders`
- Ligar pedido de visitante (sem `userId`) ao aparelho
- Alterar variáveis de produção Railway (proibido neste pedido)
