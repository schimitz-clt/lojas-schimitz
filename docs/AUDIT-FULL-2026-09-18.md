# Auditoria completa — Lojas Schimitz

**Data:** 2026-09-18 (UTC)  
**Tipo:** somente leitura + relatório. Sem mudança de comportamento da loja, Admin, API, Android, DNS, DB, Play ou cobrança.  
**Repo:** `https://github.com/schimitz-clt/lojas-schimitz`  
**Base git:** `1759599` (`main` = merge PR #49, Android `versionCode` 6 / `1.0.5`)  
**Live:** `https://lojasschimitz.com.br`  
**Auditor:** Cloud Agent (código + specs locais + smoke HTTP público)

Este documento **não declara 100%**. Cada achado tem evidência (arquivo, spec ou curl). Onde não deu para checar: **NÃO VERIFICADO** / **NÃO EXECUTADO**.

---

## Como foi auditado

| Fonte | Feito? |
|-------|--------|
| Código em `main` (`apps/api`, `apps/web`, `apps/mobile`, `prisma`, `docs`) | Sim |
| Specs de segurança API (`npm run test:security` em `apps/api`) | Sim — **passou** |
| Specs de segurança web (`npm run test:security` em `apps/web`) | Sim — **passou** |
| Suite web completa (`npm test` em `apps/web`) | Sim — **passou** (45 specs) |
| Suite API completa (`npm test` em `apps/api`) | Parcial — ver § Testes |
| Specs `*.db.spec.ts` / `payment.integration.spec.ts` | **NÃO EXECUTADO** (sem Postgres neste VM; um spec sequer faz SKIP) |
| Gradle / APK / emulador Android | **NÃO EXECUTADO** (sem SDK Android) |
| Login real / checkout / PIX / cartão / webhook aprovado | **NÃO EXECUTADO** (produção sagrada: sem cobrança) |
| Painel Admin autenticado | **NÃO VERIFICADO** (sem JWT de admin) |
| Cookie-only live (`REFRESH_JSON_TOKEN_ENABLED=false`) | **NÃO VERIFICADO** (exige login bem-sucedido) |
| Device Play closed testing | **NÃO VERIFICADO** |
| `npm audit` (dependências) | Informativo — ver FRAGILE |

Smoke live foi só leitura pública, mais POSTs que a API rejeita (webhook sem assinatura, login inválido, register inválido) e um `POST /chat` FAQ. Nenhum usuário criado, nenhum pedido, nenhum charge/refund.

---

## Resumo executivo

Não foi encontrado bypass de admin, IDOR de pedidos/pagamentos/endereços, webhook MP sem HMAC, simulate de pagamento no bundle da loja, nem stack/path de filesystem em erros live.

O bloqueio mais concreto para **venda na vitrine** continua sendo **dado de catálogo**: 9 produtos ativos, **0 foto real**, 2 sem imagem, 7 com `placehold.co`. O volume de uploads **funciona** (4 banners JPEG reais criados em 2026-09-18 ~19:33 UTC, `GET` 200). A loja filtra placeholders no front (`Imagem em breve`); a API pública ainda devolve as URLs `placehold.co`.

Controles de auth/pagamento estão alinhados com `docs/SECURITY.md` e o hardening de 2026-09-18. Residuais conhecidos (access JWT em `localStorage`, CSP com `'unsafe-inline'`/`'unsafe-eval'`, throttler in-memory, refresh JSON dual no default do código) **continuam**. O flip cookie-only **não pôde ser confirmado no Railway**.

O wrapper Android **não implementa** `onShowFileChooser` — risco alto de o seletor de fotos do Admin falhar **dentro do app** (código; device **NÃO VERIFICADO**). A correção recente de upload mobile cobre Chrome/WebView **web**, não o chooser nativo.

**Veredito:** pronta para operação assistida se o dono tratar fotos de produto e um smoke de cobrança controlado. **Não** pronta para “catálogo com foto real em todos os SKUs / marketplace automático / Melhor Envio live / Play production”. Segurança de borda (authz admin, webhook, IDOR customer, headers) está sólida no que foi possível evidenciar.

---

## URGENT

### U1 — Catálogo live sem foto real (conversão / confiança)

| Campo | Valor |
|-------|--------|
| **Severidade** | URGENT (UX de venda, não RCE) |
| **Evidência live** | `GET https://lojasschimitz.com.br/api/v1/products?page=1&pageSize=60` → `total=9` |
| **Evidência código** | Front filtra placeholder: `apps/web/src/lib/placeholder-image.ts`, `product-media.ts` (`resolveProductImageUrl` devolve `''`). Seed ainda gera `placehold.co`: `prisma/seed.ts` ~L161, ~L250. Admin DTO de URL **não** rejeita host placeholder (`apps/api/src/modules/admin/dto.ts` — só `@IsUrl`). |
| **Impacto** | Cards/PDP sem foto de produto. Dois SKUs sem `images[]` (`sansung-a54`, `ar-condicionado-aiwa-2`). Sete com `https://placehold.co/800x800/...`. Auditoria Phase 25 (2026-09-12) ainda via **1** upload real (Aiwa); agora esse SKU está vazio (`ar-condicionado-aiwa-2`). Nome live `Sansung A54` (typo). |
| **Contraste** | Uploads **não** estão mortos: `GET /api/v1/store/banners` tem 4 JPEGs em `/api/v1/uploads/…` (criados 2026-09-18T19:32–19:33Z). `HEAD` de dois arquivos → **200** `image/jpeg` + `Cache-Control: public, max-age=31536000, immutable`. `health.uploadsPersistent=true`. |
| **Fix recomendado** | Dono: fila Admin Catálogo (sem foto / placeholder) e upload real por SKU. Opcional (código, fora deste PR): rejeitar `placehold.co` no POST admin de imagem; não re-seed de placeholder em produção. |
| **Status** | Confirmado live + código. |

### U2 — Nenhum bypass crítico de authz/pagamento encontrado neste passe

Não há segundo item URGENT de segurança com evidência. Webhook sem assinatura → 401; admin sem JWT → 401; Swagger → 404; simulate flags ausentes no HTML/chunks amostrados; filtro live sem `stack`. **Não** significa “zero risco residual” — ver FRAGILE e NÃO VERIFICADO.

---

## FRAGILE

### F1 — Access JWT (`sch_access`) + `sch_user` em `localStorage`

| | |
|--|--|
| **Evidência** | `apps/web/src/lib/api.ts` L19–21, L188–196; `auth-session.ts` L85–96. Spec `auth-session.spec.ts` **passou**. |
| **Impacto** | XSS (CSP atual permite inline/eval) pode exfiltrar access ~15 min. Refresh em hosts cookie-first **não** é gravado. |
| **Fix** | CSP nonce-strict quando Brick/Next permitirem; ou access só em memória / cookie HttpOnly (`sch_access`). Já documentado em `docs/SECURITY.md` (A2). |

### F2 — Default da API ainda inclui `refreshToken` no JSON

| | |
|--|--|
| **Evidência** | `refresh-cookie.ts` L41–48: `REFRESH_JSON_TOKEN_ENABLED` default **`true`**. Web prod não persiste (`isCookieFirstHost`). |
| **Live** | **NÃO VERIFICADO** (login 401 de credencial inválida não emite sessão). |
| **Impacto** | Se o env Railway **não** flipou `false`, o JSON de login ainda carrega refresh (XSS/legado). O cliente web/Android cookie-first ignora o campo. |
| **Fix** | Checklist em `docs/SECURITY.md`: no serviço **API**, `REFRESH_JSON_TOKEN_ENABLED=false` após e2e. Este audit **não** altera env. |

### F3 — CSP storefront com `'unsafe-inline'` + `'unsafe-eval'` + `img-src https:`

| | |
|--|--|
| **Evidência código** | `apps/web/src/lib/storefront-csp.ts` L79–110. |
| **Evidência live** | `GET /` envia exatamente essa CSP (Helmet Next), incluindo `http://localhost:3000/3001` e `ws://localhost:3000` em `connect-src`. |
| **Impacto** | CSP **não** bloqueia XSS clássico de script inline. `img-src https:` é amplo. Localhost em prod é superfície inútil para o browser do cliente (não abre porta local do usuário), mas polui a política. |
| **Fix** | Nonce-strict quando Next + Mercado Pago Brick permitirem. Separar CSP dev/prod. Já adiado em `docs/SECURITY-HARDENING-2026-09-18.md`. |

### F4 — `POST /auth/register` enumera e-mail (`409 E-mail já cadastrado`)

| | |
|--|--|
| **Evidência** | `auth.service.ts` L102–104. Login/forgot são genéricos (`L144–146`, `L161–168`). |
| **Live** | Register com payload inválido → 400 validação (não exercitou 409 para não criar conta). |
| **Impacto** | Confirma cadastro. Rate limit 8/min + brute-force in-memory. |
| **Fix** | Resposta genérica como forgot-password. |

### F5 — Android WebView sem `onShowFileChooser` (Admin fotos no app)

| | |
|--|--|
| **Evidência** | `MainActivity.kt` L177–182: `WebChromeClient` só `onProgressChanged`. Grep em `apps/mobile`: **zero** `onShowFileChooser` / `ACTION_GET_CONTENT` / permissão `READ_MEDIA_*`. Manifest sem storage/camera. |
| **Contraste** | Fix web mobile existe: `admin-photo-upload.ts` (`takeFilesFromInput`, `PRODUCT_PHOTO_ACCEPT`). Spec `admin-photo-upload.spec.ts` **passou**. Isso cobre Chrome; **não** o chooser nativo. |
| **Impacto** | `<input type="file">` em WebView Android costuma não abrir galeria sem `onShowFileChooser`. Admin no app Play provavelmente não envia foto. Cliente da vitrine não precisa de file picker. Device **NÃO VERIFICADO**. |
| **Fix** | Implementar `onShowFileChooser` + `ActivityResult` + queries de `GET_CONTENT`/`OPEN_DOCUMENT`. Alinhar UA `LojasSchimitzApp/1.0.3` (L158) com `versionName` `1.0.5`. |

### F6 — Seller portal: produto de outro vendedor → **403** (não 404)

| | |
|--|--|
| **Evidência** | `seller-portal.service.ts` L91–98 `ForbiddenException`. Pedidos/pagamentos usam 404 (`ownership.ts`, `payment.idor.spec.ts` passou). |
| **Impacto** | Seller autenticado distingue id existente vs inexistente. Superfície pequena (role seller). |
| **Fix** | 404 genérico como o resto da API. |

### F7 — `OptionalJwtGuard` não reconsulta status no DB

| | |
|--|--|
| **Evidência** | `optional-jwt.guard.ts` L12–19 (só `jwt.verifyAsync`). `JwtAuthGuard` exige `status === 'active'` (`jwt-auth.guard.ts` L23–32). Usado em `cart.controller.ts` e `chat.controller.ts`. |
| **Impacto** | Usuário `blocked` ainda usa carrinho/chat com access não expirado. Rotas `/me`, pedidos, pagamentos usam o guard completo. |
| **Fix** | Mesmo lookup mínimo do `JwtAuthGuard` quando o token está presente. |

### F8 — Rotação de refresh sem lock atômico

| | |
|--|--|
| **Evidência** | `auth.service.ts` L271–281: `update` revoke depois `issue`, sem `UPDATE … WHERE revokedAt IS NULL` em transação. |
| **Impacto** | Dois refresh paralelos podem emitir duas sessões. Exploração prática **NÃO VERIFICADO**. |
| **Fix** | CAS no revoke + reuse detection (família de tokens). |

### F9 — Webhook MP: HMAC ok, janela de `ts` não aplicada

| | |
|--|--|
| **Evidência** | `payment.provider.ts` L428–456: `ts` entra no manifest HMAC; idade não é checada. Idempotência `PaymentEvent` + CAS paid mitigam replay. Spec `payment.webhook-security.spec.ts` **passou**. |
| **Live** | Sem sig → 401 `Assinatura ausente`; `x-signature: null-test-secret` → 401 `Assinatura de webhook inválida`. |
| **Fix** | Rejeitar `ts` fora de ±5 min após HMAC. |

### F10 — Multer 1.x (DoS) no upload admin

| | |
|--|--|
| **Evidência** | `apps/api/package.json` `multer@^1.4.5-lts.1`. `npm audit`: GHSA de DoS (field names aninhados, cleanup). Upload: `admin.controller.ts` L638–644 `FileInterceptor` + magic-bytes. Classe já tem `JwtAuthGuard` + `@Roles('admin')` (guards Nest **antes** de interceptors). Live `POST /admin/uploads` sem token → **401**. |
| **Impacto** | DoS autenticado (admin JWT) mais plausível que anônimo. Upgrade para multer 2.x precisa de teste de upload. |
| **Fix** | Planejar multer ≥2.3 com spec de upload. |

### F11 — Chat live com `llmConfigured: true`

| | |
|--|--|
| **Evidência live** | `GET /api/v1/chat/status` → `llmConfigured: true`, `mode: alfa`, `privateTools: ["getOrderStatus","getCustomerOrders"]`. `POST /chat` `{"message":"horario"}` → FAQ `llm: false` (atalho, não prova que o LLM está off). |
| **Evidência código** | Throttle 20/min (`chat.controller.ts` L21). Recusa injection/sql/secrets: `ai.security.spec.ts` **passou**. Tools de pedido escopam `userId` (`ai.tools.ts`, citado no audit de código). Memória in-process (`chat.memory.ts`, 400 conv / 30 min). |
| **Impacto** | Chave OpenAI **presente** em prod (Phase 25 era `llm: false` no status). Custo/abuso se alguém martelar o modelo (além do FAQ). Tools privadas só com JWT. |
| **Fix** | Monitorar billing OpenAI; manter throttle; não expor `privateTools` no status público se quiser menos enumeração. |

### F12 — Lista pública de produtos inclui `inventory.qtyOnHand` / `qtyReserved`

| | |
|--|--|
| **Evidência live** | Item `sansung-a54`: `"inventory":{"qtyOnHand":10,"qtyReserved":0},"stock":10`. `catalog.controller.ts` L67 select de inventory. `serializePublicProduct` faz spread do objeto Prisma. |
| **Impacto** | Reserva visível (timing de oversell). `stock` sozinho já revela disponibilidade. |
| **Fix** | Serializar só `stock` no público; omitir `qtyReserved`. |

### F13 — Reviews publicam na hora; lista pública inclui `user.id`

| | |
|--|--|
| **Evidência** | `reviews.service.ts` L18–24, L61–68 (`status: 'published'` no create). Exige compra paga (`hasPurchased`). |
| **Impacto** | Spam de quem comprou; UUID do autor no GET público. |
| **Fix** | Moderação opcional; omitir `user.id` (só nome). |

### F14 — `ALLOW_NULL_PROVIDER_IN_PROD` ainda existe como override de boot

| | |
|--|--|
| **Evidência** | `payment.provider.ts` L548–558. `allowNullPaymentSimulate()` é false em prod-like (`L509–512`). Spec webhook-security **passou**. |
| **Live** | Valor de `PAYMENTS_PROVIDER` **NÃO VERIFICADO**. Processo está up; webhook HMAC forte implica secret configurado. |
| **Impacto** | Misconfig: loja “prod” com NullProvider (PIX real quebraria). Simulate por `body.status` continua fail-closed. |
| **Fix** | Recusar override em `RAILWAY_ENVIRONMENT=production` mesmo com a flag. |

### F15 — README raiz ainda marca pagamentos/admin como TODO

| | |
|--|--|
| **Evidência** | `README.md` L21–23: “Pagamento Mercado Pago \| TODO SCH-003”, frete/admin TODO. |
| **Impacto** | Confunde operação. Código SCH-003+ existe. |
| **Fix** | Atualizar tabela de status (fora deste PR de audit, a menos que o dono peça). |

### F16 — Home é `'use client'` (HTML pré-renderizado quase vazio)

| | |
|--|--|
| **Evidência** | `apps/web/src/app/page.tsx` L1 `'use client'`. Live `GET /` HTML ~19 KB, um `<img>` (ícone), sem cards; `x-nextjs-prerender: 1`. Banners/produtos vêm de `fetch` no browser (`HomeBanners.tsx` L173 `/store/banners`). |
| **Impacto** | Crawler sem JS vê casca. Google em geral executa JS — **NÃO VERIFICADO** Search Console. |
| **Fix** | RSC/SSR da vitrine se SEO de produto na home for prioridade. |

---

## PASS

Controles confirmados em código **e**, quando marcado, ao vivo.

| ID | Controle | Evidência |
|----|----------|-----------|
| P1 | Refresh cookie HttpOnly; cookie > body; logout limpa cookie | `refresh-cookie.ts` L110–114, L164–173; `auth.controller.ts` L84–110. Spec `refresh-cookie.spec.ts` ok. |
| P2 | Web cookie-first: `credentials:'include'`, body `{}` fora de localhost, não grava `sch_refresh` | `auth-session.ts` L65–96; `api.ts` L94–99. Spec ok. |
| P3 | Proxy same-origin reescreve `Set-Cookie` (drop Domain, SameSite None→Lax) | `api-proxy.ts` L39–50. Spec ok. Live `/api/v1/*` passa pelo Next (headers de storefront + `x-ratelimit-*` Nest). |
| P4 | Login genérico + throttle 8/min + brute-force IP/e-mail | `auth.service.ts` L141–154; `auth.controller.ts` L60. Live login inválido → 401 `Credenciais inválidas`, sem `Set-Cookie`. |
| P5 | Forgot-password anti-enum (código; **não** POST live para não gravar token) | `auth.service.ts` L157–168. |
| P6 | `JwtAuthGuard` role/status do **DB** (JWT `role` não escala) | `jwt-auth.guard.ts` L23–34. |
| P7 | PATCH `/me` só name/phone; ValidationPipe whitelist | `users` DTO + `main.ts` L29–34. Spec `users.idor.spec.ts` ok. |
| P8 | Admin: classe `JwtAuthGuard` + `RolesGuard` + `@Roles('admin')` | `admin.controller.ts` L88–90; `admin-payments.controller.ts`. Live `GET /admin/ops` e `/admin/orders` → **401** `Token ausente`. |
| P9 | Last-admin / self-deactivate bloqueados | `admin-users.service.ts` (spec `admin-users.spec.ts` ok). |
| P10 | IDOR customer orders/payments/addresses → 404 | Specs `orders.idor` / `payment.idor` / `addresses.idor` ok. `getByPublicId` usa `{ publicId, userId }`. |
| P11 | `createIntent` / `getPayment` JWT + ownership 404 | `payments.service.ts` L149–152; controller guards. |
| P12 | Checkout: preço/estoque/frete/cupom no servidor; DTO sem amount | `CreateOrderDto` só `addressId` + cupom + cashback. `orders.service.ts` L218–255. |
| P13 | PIX 5% não empilha com cupom `PIX5` | `pricing.ts` `pixIntentChargeAmount`. Spec `pricing.spec.ts` ok. Spec DB `pix-discount.db.spec.ts` **NÃO EXECUTADO**. |
| P14 | Null simulate fail-closed em prod-like + strip `NEXT_PUBLIC_*` no `next build` | `allowNullPaymentSimulate`; `strip-public-dev-flags.ts`; `payment-simulate.ts`. Specs ok. Live HTML/chunks amostrados: sem `NULL_WEBHOOK` / `ALLOW_PAYMENT_SIMULATE`. |
| P15 | Webhook path `/api/v1/webhooks/mercadopago` + HMAC | Live 401 nas duas tentativas. |
| P16 | Swagger off | Live `/api/v1/docs` e `/docs-json` → **404**. `swagger.ts` default off em prod-like. Spec ok. |
| P17 | Filtro de erro: sem `stack`; 5xx genérico em prod-like | Spec `http-exception.filter.spec.ts` ok. Live 401/404: envelope `{ success, ok, error:{code,message,details:[]} }`. 404 inclui o path do request (`Cannot GET /api/v1/…`) — não é path de disco. |
| P18 | CORS allowlist | Live `Origin: https://evil.example` **sem** `access-control-allow-origin`. Origem da loja recebe ACAO `https://lojasschimitz.com.br`. |
| P19 | Helmet/headers loja | Live `/`: HSTS, XFO SAMEORIGIN, nosniff, Referrer-Policy, Permissions-Policy, COOP, CORP, CSP. Sem `x-powered-by`. `www` → **301** apex (Cloudflare). |
| P20 | Uploads: magic-bytes JPG/PNG/WebP, 15 MB, UUID, admin-only | `upload-validate.ts`; spec ok. Live POST uploads 401. |
| P21 | `GET /health` e `/health/ready` | Live **200**, `env=production`, `mailConfigured=true`, `uploadsPersistent=true`, `ready.db=up`. (Phase 25: ready era 404 — **corrigido no deploy**.) |
| P22 | Android: `allowFileAccess=false`, cleartext off, 3P cookies off, mixed content never, SSL `cancel()` | `MainActivity.kt` + manifest. Spec `android-webview-security.spec.ts` ok. |
| P23 | Asset Links publicados e reconhecidos pelo Google | `apps/web/public/.well-known/assetlinks.json` live 200; API Digital Asset Links devolve **os dois** SHA-256 do arquivo (`CA:9C:…:5A` upload, `48:B5:…:7C` Play Signing). |
| P24 | Política de privacidade no ar | Live `GET /privacidade` **200**. Página cita e-mail/WhatsApp. Texto ainda diz “TWA” — o app é WebView (`apps/mobile/README.md`). |
| P25 | PDP gallery / banners / brand icons (código + specs) | Specs `pdp-gallery-layout`, `home-banners`, `brand-icons`, `order-card-ui`, `admin-photo-upload` **passaram**. Comportamento visual no device **NÃO VERIFICADO**. |
| P26 | Melhor Envio **não finge** sucesso | `melhor-envio.carrier.ts`: sem token `NOT_CONFIGURED`; com token `CARRIER_LIVE_NOT_WIRED`. |
| P27 | Amount de pagamento não vem do cliente | DTO intent sem `amount`; charge de `order.total` / `pixIntentChargeAmount`. Brick manda token (`card-payment-ui.ts`). |

---

## OPS (Play / testers / fotos)

### Fotos

| Item | Estado 2026-09-18 |
|------|-------------------|
| Volume `/data` | `uploadsPersistent: true` no health |
| Banners home | **4** JPEGs reais em `/api/v1/uploads/…` (hoje). `HEAD` 200 |
| Produtos | **0/9** foto real; 2 vazios; 7 `placehold.co` |
| Fila Admin | Código em `admin-ops.ts` (`placeholder_photos`). UI autenticada **NÃO VERIFICADO** |
| Seed | Ainda escreve `placehold.co` se produto sem imagem |

Ação do dono: substituir placeholders no Catálogo. Não inventar imagem no código.

### Play / Android

| Item | Estado | Nota |
|------|--------|------|
| `applicationId` | `com.lojasschimitz.app` | Manifest + assetlinks |
| `versionCode` / `versionName` | **6 / 1.0.5** | `app/build.gradle.kts` (PR #49) |
| User-Agent WebView | `LojasSchimitzApp/1.0.3` | Defasado vs 1.0.5 |
| Closed testing / 12 testers | **NÃO VERIFICADO** | Fora deste VM |
| App Signing SHA no site | **PASS** (Google DAL lista os 2 fingerprints) | Confirmar no Play Console se ainda são os certs atuais |
| `allowBackup=true` | Presente | Residual de backup de WebView |
| `isMinifyEnabled=false` | Release sem R8 | Tamanho; não é bug de loja |
| Publicação Play production | Fora de escopo | README: dono publica |
| File chooser nativo | Ausente | F5 |

### Testers / smoke que o dono ainda precisa

1. Login real web + Android: JSON **sem** `refreshToken` se o flip cookie-only estiver on; cookie `sch_refresh` HttpOnly; logout limpa.  
2. 1 PIX + 1 cartão **controlados** (sandbox/prod acordado): intent → pagar → webhook → `paid` + e-mail + estoque. **Não feito aqui.**  
3. Admin no **Chrome Android** (upload já tem workaround) vs **app WebView** (F5).  
4. Contagem de testers closed track na Play Console.

### Outros ops

| Item | Estado |
|------|--------|
| E-mail | `mailConfigured: true`. Deliverability inbox **NÃO VERIFICADO** |
| LLM | Chave presente (`llmConfigured: true`) — conferir billing |
| Throttler | In-memory, por processo (`app.module.ts` L33). Multi-réplica **NÃO VERIFICADO** |
| Redis | `.env.example` menciona `REDIS_URL`; API usa Throttler in-process. Sem Redis compartilhado |
| Marketplace split / Schimitz+ campanha | Ledger/prep; sem split MP. Sem mudança |
| WhatsApp | Só `wa.me` (live chat devolve link). Sem Cloud API |
| `scheduler-lock.db.spec.ts` | Falha este VM (tenta `127.0.0.1:5432` sem SKIP). Outros `*.db.spec.ts` SKIP sem `DATABASE_URL`. Fragilidade de CI local, não da loja live |

---

## TODOs / stubs / mocks no caminho de pagamento

Busca `TODO`/`FIXME`/`HACK` em `apps/**/*.ts,tsx,kt`: **nenhum** TODO de código (só comentário em português “TODOS os admins”).

| Caminho | Estado honesto |
|---------|----------------|
| `NullPaymentProvider` | Default local (`PAYMENTS_PROVIDER=null` em `.env.example`). Boot prod-like **recusa** sem `ALLOW_NULL_PROVIDER_IN_PROD`. Simulate UI só `NODE_ENV !== production`. **Não** há rota HTTP de mock. |
| `payment.integration.spec.ts` | Usa NullProvider + Postgres local — **NÃO EXECUTADO** aqui (sem `DATABASE_URL`). |
| Melhor Envio | Stub explícito (P26). |
| README “TODO SCH-003” | Docs stale (F15). |

---

## Testes (esta auditoria)

### Executados e OK

**API `npm run test:security`:** prod-like-env, http-exception.filter, swagger, refresh-cookie, login-attempt, roles.guard, ownership, orders/addresses/users/payments IDOR, payment.null, payment.webhook-security, admin-orders-search, upload-validate.

**API unitários adicionais (após o corte do `npm test` no spec DB):** mail, loyalty math, coupons, admin-users/sales, shipping quote, carrier stub, reviews eligibility, payment translate/null/webhook/status/idempotency/chaos/orphan/reconciliation, chat+ai.security+tools, inventory reservation (in-memory), notifications, sellers/commissions unit, catalog serialize/query/hygiene, uploads, admin-ops, pricing, storefront banners, customer-visible, etc. **55 specs OK** nesse segundo lote.

**Web `npm test`:** 45 specs OK, incluindo auth-session, api-proxy, admin-photo-upload, placeholder-image, home-banners, storefront-security-headers, payment-simulate, strip-public-dev-flags, android-webview-security, pix/card UI, pdp-gallery-layout, product-gallery, order-card-ui, brand-icons.

### Falha de ambiente (não é bug da loja)

| Spec | Resultado |
|------|-----------|
| `scheduler-lock.db.spec.ts` | **Falhou** este VM: `Can't reach database server at 127.0.0.1:5432` (default hard-coded; **não SKIP**) |
| `payment.integration.spec.ts` | **Falhou** sem `DATABASE_URL` (integração Postgres + NullProvider; nome **não** é `*.db.spec.ts`) |
| Demais `*.db.spec.ts` | **NÃO EXECUTADO** / SKIP intencional neste passe (11 arquivos pulados no segundo lote) |

### NÃO EXECUTADO

- Gradle `:app:assembleDebug` / `bundleRelease`
- E2E browser (Playwright/Cypress — não há suite no repo)
- Chaos DB-down, race de estoque real, cobrança MP
- `npm audit fix` (não aplicado; só inventário)

`npm audit` (informativo, sem PoC): API — multer 1.x DoS (F10), nodemailer, js-yaml, lodash, prisma/deepmerge-ts; Web — `next` moderate, `postcss` high. **Não** convertidos em URGENT sem evidência de rota explorável além do upload admin já gated.

---

## Smoke live (2026-09-18 ~19:35 UTC)

Host: `https://lojasschimitz.com.br` (apex). `www` → 301 Cloudflare para o apex.

| Chamada | Resultado |
|---------|-----------|
| `GET /` | 200 + HSTS/CSP/COOP/CORP/Permissions-Policy; sem `x-powered-by` |
| `GET /api/v1/health` | 200 `env=production` `mailConfigured=true` `uploadsPersistent=true` |
| `GET /api/v1/health/ready` | 200 `ready=true` `db=up` |
| `GET /api/v1/docs` | 404 |
| `GET /api/v1/admin/ops` | 401 `Token ausente` |
| `GET /api/v1/admin/orders` | 401 `Token ausente` |
| `POST /api/v1/admin/uploads` | 401 `Token ausente` |
| `POST /api/v1/webhooks/mercadopago` `{}` | 401 `Assinatura ausente` |
| `POST` webhook `x-signature: null-test-secret` | 401 `Assinatura de webhook inválida` |
| `GET /api/v1/products?pageSize=60` | 200 total **9** — ver U1 |
| `GET /api/v1/store/banners` | 200, **4** banners upload |
| `HEAD /api/v1/uploads/<banner>.jpg` | 200 `image/jpeg` |
| `GET /api/v1/uploads/0000…0000.jpg` | 404 |
| `POST /api/v1/chat` `horario` | 201/200 FAQ, `llm=false`, `wa.me` |
| `GET /api/v1/chat/status` | `llmConfigured=true` |
| `POST /api/v1/auth/login` credencial falsa | 401 `Credenciais inválidas` |
| `POST /api/v1/auth/register` inválido | 400 `VALIDATION_ERROR` (mensagens em inglês, ex. `email must be an email`) |
| CORS evil vs loja | sem ACAO / com ACAO |
| `GET /.well-known/assetlinks.json` | 200, 2 fingerprints |
| Google DAL `statements:list` | 200, mesmos 2 certs |
| `GET /privacidade` `/robots.txt` `/sitemap.xml` `/admin` | 200 HTML (admin é casca; API é o gate) |

Catálogo detalhado:

| slug | imagem |
|------|--------|
| `sansung-a54` | vazia (`images: []`) — nome **Sansung** |
| `ar-condicionado-aiwa-2` | vazia |
| `roblox` | placehold.co |
| `tenis-running` | placehold.co |
| `aspirador-robo` | placehold.co |
| `geladeira-frost-free-400l` | placehold.co |
| `smartphone-128gb` | placehold.co |
| `notebook-i5-16gb-512ssd` | placehold.co |
| `smart-tv-55-4k` | placehold.co |

---

## NÃO VERIFICADO (explícito)

- Valor Railway de `REFRESH_JSON_TOKEN_ENABLED`, `PAYMENTS_PROVIDER`, `JWT_*_SECRET` entropia, `MERCADO_PAGO_*` (só o *comportamento* de rejeitar webhook sem HMAC).  
- Login/refresh/logout cookie-only no browser e no WebView.  
- Checkout PIX/cartão ponta a ponta, Brick 3DS, webhook `approved` → `paid`, e-mail na caixa de entrada, CAS estoque sob carga.  
- Refund admin live.  
- Admin autenticado (ops badges, CSV fotos, upload mobile no Chrome).  
- File picker no APK 1.0.5 em device.  
- Play Console: testers, status closed/internal, Data safety.  
- Multi-réplica (throttler/login-attempt por processo).  
- Conteúdo das 4 imagens de banner (só headers JPEG 200).  
- SEO real (Search Console) da home client-only.  
- Inbox Resend / SPF / DKIM.  
- Specs DB / `payment.integration.spec.ts` / Gradle.

---

## Comparação com auditorias anteriores (só o que mudou com evidência)

| Tema | Phase 25 (2026-09-12) / hardening 2026-09-18 | Este passe |
|------|-----------------------------------------------|------------|
| `GET /health/ready` | 404 (deploy lag) | **200** |
| `uploadsPersistent` | não destacado | **true** |
| Fotos produto | 1 upload real + 7 placeholder + 1 missing | **0** upload real + 7 placeholder + 2 missing |
| Banners | não medido assim | **4** uploads reais hoje |
| Chat `llmConfigured` | false no smoke antigo | **true** |
| Headers CSP loja | Phase A no código | **Presente live** |
| Android version | 1.0.3 citado na Phase 25 | **1.0.5** (`versionCode` 6); UA ainda 1.0.3 |

---

## COMMIT

| Campo | Valor |
|-------|--------|
| **Doc** | `docs/AUDIT-FULL-2026-09-18.md` |
| **Código da loja** | sem alteração (report-only) |
| **Base** | `1759599` on `main` |
