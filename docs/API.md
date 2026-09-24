# API `/api/v1`

Envelope de sucesso: `{ "ok": true, "data": {}, "meta": { "requestId": "uuid" } }`
Envelope de erro: `{ "ok": false, "error": { "code": "...", "message": "..." }, "meta": { "requestId": "uuid" } }`

Header de usuário: `Authorization: Bearer <access_token>`
Header de visitante no carrinho: `x-guest-token: <uuid>`

| Método | Rota | Acesso |
|---|---|---|
| GET | `/health` | público — liveness (`mailConfigured`, `fcmConfigured` boolean — presença de env, sem segredos) |
| GET | `/health/ready` | público — readiness (DB `SELECT 1`) |
| GET | `/admin/ops` | admin — command center: inventory + placeholders + `payments.pendingCount` + `reconciliations.{openCount,recent[]}` + `mail.{configured,storeNotifyConfigured,providerOffWithStoreNotify,lastStoreNotifyFailure,storeNotifyFailureCount}` + `orders.{byStatus,buckets,total}` + `sales.{today,last30d}` + `alerts[]` (open_reconciliations first; store_notify_mail_failed when a real send/skip event exists) |
| GET | `/admin/payments/reconciliations` | admin — open PaymentReconciliation rows (Jwt+admin; no secrets) |
| GET | `/admin/ops/products-needing-photos` | admin — CSV `{ filename, csv }` colunas `id,name,imageUrl` (sem gerar fotos) |
| POST | `/auth/register` | público |
| POST | `/auth/login` | público |
| POST | `/auth/refresh` body opcional `{ refreshToken }` **ou** cookie HttpOnly `sch_refresh` | público |
| POST | `/auth/logout` | user |
| POST | `/auth/forgot-password` body `{ email }` → mensagem genérica (anti-enumeração); token SHA-256 no DB; e-mail Resend HTTP / SMTP ou log local | público (throttle) |
| POST | `/auth/reset-password` body `{ token, password }` → invalida refresh + tokens reset | público (throttle) |
| GET/PATCH | `/me` | user |
| GET | `/me/loyalty` | user (SCHIMITZ+ saldo + extrato) |
| GET/POST/PATCH/DELETE | `/me/addresses` | user |
| GET | `/categories` | público |
| GET | `/products` `?q=&category=&seller=&minPrice=&maxPrice=&sort=&page=&pageSize=` → items com `stock`, `image`, `imageUrl`, `isDemo` (+ nested images/inventory/seller). `total` = ativos da navegação (inclui DEMO). `sellableTotal` = active && !isDemo. `demoTotal` = active && isDemo. Só produtos de vendedor `active`. `seller` = slug público | público |
| GET | `/products/:slug` → mesmo shape (stock = disponível; image = URL primária). 404 se vendedor não estiver `active` | público |
| GET | `/sellers` → `[{ id, name, slug, productCount }]` vendedores **active** (sem PII / comissão / dono) | público |
| GET/DELETE | `/cart` | user ou guest — `coupon`, `couponError`, `discount`, `total` quando um código está persistido |
| POST/PATCH/DELETE | `/cart/items` | user ou guest |
| POST | `/cart/coupon` body `{ code }` — valida e persiste no carrinho (idempotente) | user ou guest |
| DELETE | `/cart/coupon` — remove o cupom da sacola | user ou guest |
| POST/GET | `/orders` body create `{ addressId, couponCode?, cashbackAmount? }` — **400 `MARKETPLACE_MIXED_CART`** se o carrinho tiver mais de um vendedor (v2.1, flags off também); **400 `DEMO_NOT_PURCHASABLE`** se houver item `isDemo` (não reserva estoque). O mesmo código bloqueia `POST /cart/items` e a intenção de pagamento | user |
| GET | `/orders/:publicId` | user — inclui `marketplaceSplit: { active, bricksPublicKey }` (public key TEST- do seller só no sandbox; sem tokens) |
| POST | `/coupons/validate` body `{ code, subtotal }` → `collidesWithPixPromo` se o código duplica o 5% PIX | user |
| POST | `/shipping/quote` body `{ cep, subtotal, items? }` | público (JWT opcional). Calcula via Melhor Envio. CEP 90/91: preço 0 e prazo calculado. Sem token: 422 `SHIPPING_QUOTE_UNAVAILABLE` (não devolve a taxa padrão). |
| GET | `/admin/shipping` | admin |
| PATCH | `/admin/shipping/settings` body `{ freeAbove, defaultFee, defaultDays }` | admin |
| POST | `/admin/shipping/rules` body `{ cepPrefix, fee, estimatedDays, label?, active? }` | admin |
| PATCH | `/admin/shipping/rules/:id` | admin |
| DELETE | `/admin/shipping/rules/:id` | admin |
| GET/POST | `/admin/coupons` | admin |
| PATCH | `/admin/coupons/:id` | admin |
| GET/POST/DELETE | `/favorites` | **user (JWT)** — lista de desejos (Salvos). `GET` devolve produtos reais no shape de `GET /products` (foto, preço, stock, PIX no card). `POST { productId }` e `DELETE /favorites/:productId` são **idempotentes**. Visitante: 401; o coração na vitrine pode marcar só neste aparelho até o login (ver `docs/WISHLIST.md`). **Deploy:** migration aditiva `20260920_wishlist_favorite_list_idx` (índice; tabela `Favorite` já existia). |
| GET | `/products/:id/reviews` | público (só publicadas) |
| GET | `/products/:id/reviews/me` | user (elegibilidade + minha avaliação) |
| POST | `/products/:id/reviews` | user comprador (upsert 1–5 ★ + texto) |
| GET | `/admin/reviews` | admin |
| PATCH | `/admin/reviews/:id` body `{ status: "published"|"hidden" }` | admin |
| DELETE | `/admin/reviews/:id` | admin |
| GET | `/admin/orders` `?status=` (OrderStatus ou bucket `problems`) `&q=` (publicId prefix / e-mail / nome; ≥3 ou SCH-…; take≤50, throttle) — sem `q` take 100; inclui `user.phone`; `/admin/products` `/admin/categories` | admin |
| GET | `/admin/products/catalog-counts` → `{ total, demo, real, sellable }` com `sellable = active && !isDemo` | admin |
| GET | `/admin/reports/sales` `?from=&to=` (YYYY-MM-DD) → resumo, byStatus, byDay, bySeller, topProducts, byPaymentMethod | admin |
| POST | `/admin/uploads` multipart `file` (jpg/png/webp ≤15MB; magic-bytes; erros `UPLOAD_*`) → `{ url, filename }` (url apex se SITE_URL/APP_URL) | admin |
| POST | `/admin/products` body `{ name, price, description?, sku?, stock?, categoryId?, sellerId?, active?, imageUrl?, compareAtPrice?, badge? }` | admin |
| PATCH | `/admin/products/:id` (mesmos campos, parciais) | admin |
| PATCH | `/admin/orders/:id/status` body `{ status, trackingCode?, carrier? }` (fulfillment; `in_transit`/`shipped` normaliza via CarrierProvider — default `propria` manual) | admin |

### Logística (conceitos Phase 14)

| Conceito | Onde | Nota |
|----------|------|------|
| **FREIGHT** | `POST /shipping/quote`, `Order.freight` / `freightSnap` | Cotação Melhor Envio (`calculate`). Zona taxa 0 = cliente paga R$ 0; `days` é o prazo calculado. `carrierPrice` é o valor antes do subsídio. |
| **CARRIER** | `Order.carrier`, `CarrierProvider` (`CARRIER_PROVIDER`) | Default `propria` (etiqueta manual). `CARRIER_PROVIDER` não liga a cotação. |
| **TRACKING** | `Order.trackingCode` | Manual no admin ao marcar Em trânsito. Melhor Envio track continua NOT_WIRED. |
| **ORDER** | `Order` + `OrderStatus` | Máquina de estados Phase 12 |
| **DELIVERY** | `in_transit` → `delivered` | Sem sync automático de transportadora |

Cotação: `MELHOR_ENVIO_TOKEN` ou `MELHOR_ENVIO_ACCESS_TOKEN`. Sandbox: `MELHOR_ENVIO_SANDBOX=true` (ou `MELHOR_ENVIO_BASE_URL`). Origem: `MELHOR_ENVIO_ORIGIN_CEP` (padrão `91250000`). User-Agent padrão `Lojas Schimitz (schimitzclaiton@gmail.com)`, override `MELHOR_ENVIO_USER_AGENT`. O calculate envia `services` `1,2,3,4,17` (PAC, SEDEX, Jadlog .Package, Jadlog .Com, Mini Envios) para a resposta vir em array; um único serviço em objeto também é aceito. Sem token ou se a API não devolver opção viável, a cotação falha com `SHIPPING_QUOTE_UNAVAILABLE` — não usa `defaultFee`. A escolha única é a opção viável mais barata (`custom_price`, senão `price`; empate pelo menor prazo). Compra de etiqueta não é feita. Nunca commitar o token.
| GET/POST | `/admin/sellers` | admin |
| PATCH | `/admin/sellers/:id/status` body `{ status: "pending"|"active"|"suspended" }` | admin |
| POST | `/payments/intents` body `{ orderId, method, installments?, cardToken? }` | user |
| GET | `/store/settings` | público (SEO) |
| GET | `/store/banners` | público (banners ativos) |
| GET | `/store/shelves` | público — prateleiras da home `{ shelves: [{ id, title, subtitle, href, linkLabel, metric, items }] }`. `items` = mesmo shape de `GET /products`. Sem mock. Rails vazias omitidas. Semântica: `docs/HOME-SHELVES.md` |
| GET/PATCH | `/admin/store/settings` body `{ siteTitle, siteDescription, ogImageUrl? }` | admin |
| GET/POST | `/admin/banners` | admin |
| PATCH | `/admin/banners/reorder` body `{ orderedIds: string[] }` | admin |
| PATCH/DELETE | `/admin/banners/:id` | admin |
| GET | `/admin/admins` → lista usuários role=admin | admin |
| POST | `/admin/admins` body `{ email, name, password }` (argon2) | admin |
| PATCH | `/admin/admins/:id/status` body `{ status: "active"|"blocked" }` — não desativa a si mesmo / último admin ativo; ao desativar revoga refresh tokens | admin |
| POST | `/chat` body `{ message, conversationId? }` → reply + handoff + produtos reais + `level`/`tools`/`intent` (Alfa). JWT opcional só para pedido do próprio user | público (20/min) |
| GET | `/chat/status` → `{ mode, llmConfigured, tools }` (sem segredos) | público |

| GET | `/seller/me` | seller owner (JWT) — inclui `mp` (`connectEnabled`, `houseBrand`, `oauthStatus`, `linked`, `mpUserId`) |
| GET | `/seller/products` | seller owner |
| PATCH | `/seller/products/:id` body `{ price?, stock? }` | seller owner (own products only) |
| GET | `/seller/orders` | seller owner (read-only) |
| GET | `/seller/commissions` | seller owner (own ledger + totals, read-only) |
| GET | `/seller/mp` | seller owner — status OAuth (sem tokens) |
| GET | `/seller/mp/connect` | seller owner — URL OAuth; **404 `MP_CONNECT_DISABLED`** se `MP_MARKETPLACE_SPLIT_ENABLED` off; **400 `HOUSE_BRAND_NO_SELF_SPLIT`** na loja própria |
| POST | `/seller/mp/callback` body `{ code, state }` | seller owner — troca code→token (HTTP MP); tokens só em `SellerMpCredential` criptografado |
| PATCH | `/admin/sellers/:id` body `{ ownerUserId?, ownerEmail?, commissionPercent? }` | admin |
| GET | `/admin/commissions` `?status=pending|approved|paid|all&sellerId=` | admin |
| PATCH | `/admin/commissions/:id/approve` body `{ note? }` | admin (pending → approved) |
| PATCH | `/admin/commissions/:id/paid` body `{ payoutReference?, note? }` | admin (pending/approved → paid; PIX ref manual). **400 `COMMISSION_SPLIT_SOURCE`** se `source=mp_application_fee` |
| GET | `/admin/commissions/export` `?sellerId=&status=` → `{ csv, filename, count }` | admin |

| GET | `/admin/customers` `?q=&take=&skip=` → `{ items, total, take, skip }` CRM read-only; `q` nome/e-mail/telefone; item: `ordersCount`, `paidOrdersCount`, `paidTotal`, `lastPaidAt`, `lastOrderAt`, `city`, `uf` | admin |
| GET | `/admin/customers/:id` → cliente + endereços + até 50 pedidos (`publicId`, status, totais, data, `paymentMethod`/`paymentStatus`) sem `passwordHash` | admin |

### Push FCM (promoções Android)

Independente da tabela in-app `Notification` (`GET /notifications`). Cookie/JWT no upsert. Ver `docs/PUSH-FCM.md`.

| Método | Rota | Acesso |
|---|---|---|
| POST | `/push/tokens` body `{ token, platform?: "android", enabled?, appVersion? }` — upsert único; logado vincula `userId`; visitante fica nulo | JWT opcional |
| POST | `/push/product-views` body `{ productId?, slug?, deviceId? }` — visita à PDP do aparelho (`deviceId` ou cookie `sch_push_device`). Sem aparelho registrado: `{ recorded: false }`, não cria token | JWT opcional |
| GET | `/admin/push/abandoned-views` — contagem somente leitura (não envia) | admin |
| GET | `/admin/push/status` → `{ firebaseConfigured, source, projectId }` sem JSON da service account | admin |
| GET | `/admin/push/tokens` → aparelhos (id, enabled, lastSeen, userBound) **sem** o token FCM | admin |
| GET | `/admin/push/campaigns` | admin |
| GET | `/admin/push/campaigns/:id` + dispatches (fingerprint) | admin |
| POST | `/admin/push/campaigns` body `{ title, body, imageUrl?, linkPath?, audience: all_enabled\|with_orders, sendMode: immediate\|scheduled, scheduledAt? }` | admin |
| POST | `/admin/push/campaigns/:id/cancel` | admin |
| POST | `/admin/push/campaigns/:id/send` | admin |
| POST | `/admin/push/test` body `{ tokenId, title?, body?, linkPath? }` — um aparelho | admin |

Sem `FIREBASE_SERVICE_ACCOUNT_JSON` o envio é **NÃO EXECUTADO** (status failed + skipped). CI não dispara FCM real.

## OpenAPI / Swagger

- UI: `GET /api/v1/docs` (quando habilitado)
- Default: **ligado** em development/test; **desligado** em production/staging
- Override: `SWAGGER_ENABLED=true|false`
- Documenta auth, catalog, cart, shipping, orders, payments, addresses, admin, webhooks, health
- Não embute JWT/SMTP/MP secrets no schema


## Sessão / cookies (SCH-006)

- Login/refresh: `Set-Cookie: sch_refresh=...` e `Set-Cookie: sch_access=...` (ambos HttpOnly).
- `POST /auth/register` — sucesso abre sessão como o login (`Set-Cookie` `sch_refresh` + `sch_access`, JSON com `user` e `accessToken`). E-mail já usado: **409** `Este e-mail já possui conta. Faça login.` CPF já usado: **409** `Este CPF já possui conta. Entre ou use outro CPF.` CPF inválido ou menor de 18: **400**. Carrinho guest (`x-guest-token`) é mesclado no sucesso.
- Clientes web devem usar `credentials: 'include'` (CORS já `credentials: true`).
- Access token: cookie HttpOnly `sch_access` **ou** header `Authorization: Bearer` (Bearer tem precedência).
- JSON inclui `refreshToken` **por default** (`REFRESH_JSON_TOKEN_ENABLED` unset/true).
  Com cookie enabled + `REFRESH_JSON_TOKEN_ENABLED=false` o campo é **omitido** (cookie-only).
  Body `{ refreshToken }` ainda é aceito no refresh/logout como fallback (cookie tem precedência).


## URLs públicas de upload

Imagens persistidas como `https://lojas-schimitz-production.up.railway.app/api/v1/uploads/...`
são reescritas na serialização (catálogo, banners, carrinho, seller, resposta de upload)
para `https://lojasschimitz.com.br/api/v1/uploads/...`. O path same-origin faz proxy
(verificado: mesmo PNG/etag no apex e no host Railway). O arquivo no disco/DB não muda.

Uploads novos (`POST /admin/uploads`) gravam a URL pública no apex quando
`SITE_URL` / `APP_URL` / `NEXT_PUBLIC_SITE_URL` / `PUBLIC_WEB_URL` está definido
(www é normalizado para o apex). Sem essas vars, cai em `PUBLIC_API_URL` e o rewrite
Railway → apex continua. Validação: JPG/PNG/WebP por magic-bytes, máx. 15 MB;
`LIMIT_FILE_SIZE` do Multer vira 400 `UPLOAD_TOO_LARGE` (não 500).
