# Marketplace — Lojas Schimitz

## v1 (fechado com evidência)

Multi-seller **foundation** sem quebrar o checkout único. Evidência abaixo é live (2026-09-19) + testes do repo — sem mock / NullProvider como “pronto”.

### O que o v1 faz

- Model `Seller`: name, slug, status (`pending` | `active` | `suspended`), optional `ownerUserId`, optional `commissionPercent` (só ledger — **não** entra no payload MP).
- `Product.sellerId` (obrigatório). Catálogo existente backfill na loja própria **Lojas Schimitz** (`slug=lojas-schimitz`, id `00000000-0000-4000-8000-000000000001`).
- APIs públicas de produto incluem `seller: { id, name, slug }`. Listagem e PDP mostram **Vendido por**.
- `GET /sellers` lista só vendedores `active` (`id, name, slug, productCount`) — sem PII.
- Catálogo público esconde produto cujo vendedor não está `active`. Filtro opcional `?seller=<slug>`.
- Admin: `GET/POST /admin/sellers`, `PATCH /admin/sellers/:id/status`, `PATCH /admin/sellers/:id` (dono + `commissionPercent`).
- Checkout unificado. `OrderItem.sellerId` é snapshot na criação do pedido. Carrinho com mais de um vendedor é rejeitado (`MARKETPLACE_MIXED_CART`) — regra v2.1, independente das flags de split.

### Seller portal v1

- Login normal; admin vincula via `Seller.ownerUserId` (promove `customer` → `seller`; **não** altera `admin`).
- Web: `/vendedor` (PT).
- API (JWT + ownership, não só `role=seller`):
  - `GET /seller/me`
  - `GET /seller/products`
  - `PATCH /seller/products/:id` body `{ price?, stock? }` — **só produtos próprios**
  - `GET /seller/orders` — itens próprios agrupados por pedido (read-only)
  - `GET /seller/commissions` — ledger próprio + totais (read-only)
- Authz: `FORBIDDEN_OTHER_SELLER` / `FORBIDDEN_OTHER_SELLER_COMMISSION`. Conta (`/conta`) continua só cliente — sem atalho Admin/vendedor.

### Commission ledger + Repasse v1

- No pedido → `paid` (CAS ou retry se o pedido já está `paid`): `CommissionLedger` por item com `sellerId`.
  - `amount = itemTotal * commissionPercent / 100` (padrão **10%**)
  - `status = pending`
  - Idempotente em `orderItemId`
- Transições manuais: `pending` → `approved` | `paid`; `approved` → `paid`.
- Admin: listar, aprovar, marcar pago (`payoutReference` = PIX E2E), CSV (`sellerId` obrigatório).
- Seller UI: totais + lista read-only.

### Importante — dinheiro ainda é manual

> **Não há split automático live (`APP_USR` / `ALLOW_LIVE`) no pagamento.**  
> Fase 2 (sandbox): com `MP_MARKETPLACE_SPLIT_ENABLED=true`, `ALLOW_LIVE=false` e tokens `TEST-`, o intent de um vendedor vinculado envia `application_fee` no token do seller. Produção com credenciais live continua no collector da loja.  
> Plano: [`MARKETPLACE-MP-SPLIT-PLAN.md`](./MARKETPLACE-MP-SPLIT-PLAN.md). **Não ligar `ALLOW_LIVE` em production.**

## Checklist v1 — PASS / FRAGILE / FAIL

| Item | Status | Evidência |
|---|---|---|
| Catálogo mostra seller nas APIs + PDP “Vendido por” | **PASS** | Live `GET https://lojasschimitz.com.br/api/v1/products?page=1&pageSize=3` → cada item `seller: { id: 00000000-…0001, name: "Lojas Schimitz", slug: "lojas-schimitz" }`. Live `GET /api/v1/products/sansung-a54` → mesmo seller. PDP: `ProductClient` renderiza `Vendido por`; SSR passa `initial` via `fetchPublicProduct` (antes o HTML sem JS não trazia o texto — curl 2026-09-19). Cards: `ProductCard` + compare `Vendido por`. |
| Admin cria/lista/status e vincula dono | **PASS** | Código: `AdminController` `GET/POST /admin/sellers`, `PATCH …/status`, `PATCH …/:id` (`ownerEmail` / `ownerUserId` + `commissionPercent`). UI `/admin/marketplace`: criar, Ativar/Suspender, Salvar dono / %. Live unauth `GET /admin/sellers` → **401 Token ausente** (rota existe, não é 404). Não criamos segundo vendedor no DB de produção. |
| Portal /vendedor: me, produtos próprios, pedidos, comissões | **PASS** | `SellerPortalController` + `/vendedor` carrega os 4 endpoints. Live unauth `GET /seller/me` → **401**. Authz unit: `seller-portal.authz.spec.ts`. DB: `sellers.db.spec.ts`, `commissions.db.spec.ts`. |
| Ledger no pedido pago; admin approve/paid + CSV | **PASS** | `PaymentsService` chama `recordOnPaid` no CAS `paid` **e** no retry `already_paid` (idempotente). `commissions.db.spec.ts` instancia `CommissionsService.recordOnPaid` de verdade (não mock). Admin UI: Aprovar / Marcar pago / Exportar CSV. |
| Checkout unificado (sem quebra) | **PASS** | Um `POST /orders` → um `Payment` → `POST /v1/payments` com token da plataforma (sem `application_fee` / `marketplace_fee`). PIX 5% e cartão Brick inalterados. Carrinho misto → `MARKETPLACE_MIXED_CART`. `/marketplace` declara checkout único. |
| Authz: seller não toca dados de outro | **PASS** | `assertSellerCanUpdateProduct` / `listForSeller(sellerId)` / orders `where.sellerId = owned`. Tests: `seller-portal.authz.spec.ts`, `commissions.spec.ts`. Admin `/admin/*` exige `role=admin`. |
| Página /marketplace honesta | **PASS** (após deploy deste PR) | Live pré-PR: hub explicativo falava em “vendedores parceiros” sem lista real; `GET /api/v1/sellers` → **404 NOT_FOUND**. Agora: lista vendedores **active** da API (fallback: sellers únicos do catálogo); copy de loja própria quando só existe Lojas Schimitz; seção explícita do que o v1 **não** faz (split MP, OAuth, frete por vendedor, chargeback). Teste: `marketplace-copy.spec.ts`. |
| `GET /sellers` público | **PASS** (código; live 404 até o deploy) | Novo `SellersPublicController`. Só `active`, sem e-mail/dono/%. Testes de shape em `sellers.spec.ts` + hide suspenso em `sellers.db.spec.ts`. |

## Catalog hygiene (SCH-009)

Idempotente: Roblox com estoque 0 → 50; produto ativo sem imagem → placeholder. Não apaga catálogo.

## Fora do v1 (não inventar como “pronto”)

| Area | Status | Notes |
|---|---|---|
| **OpenAI billing** | Bloqueio externo | Chat cai no FAQ/catálogo sem chave. |
| **Play Store / Android TWA** | Ops + assets | Fora de marketplace. |
| **Split MP automático** | Fase 2 sandbox (TEST- only) | Ver [`MARKETPLACE-MP-SPLIT-PLAN.md`](./MARKETPLACE-MP-SPLIT-PLAN.md). Produção live = Fase 3 + OK explícito. |
| **Frete por vendedor** | Planejado | Checkout continua um frete só. |
| **Alocação de disputa** | Planejado | `charged_back` → status local `unknown`; sem rateio. |

## Como validar (sem dinheiro live)

```bash
# Seller no catálogo
curl -sS "https://lojasschimitz.com.br/api/v1/products?page=1&pageSize=3" | jq '.data.items[0].seller'

# Diretório público (após deploy)
curl -sS "https://lojasschimitz.com.br/api/v1/sellers" | jq '.data'

# Authz (sem token)
curl -sS -o /dev/null -w "%{http_code}\n" "https://lojasschimitz.com.br/api/v1/admin/sellers"   # 401
curl -sS -o /dev/null -w "%{http_code}\n" "https://lojasschimitz.com.br/api/v1/seller/me"      # 401

# Testes
npm test --workspace=@schimitz/api
npm test --workspace=@schimitz/web
```

Admin cria o segundo vendedor pelo fluxo `/admin/marketplace` quando quiser um parceiro real. **Não** semear vendedor fake em produção.

## Fase 1 — OAuth + carrinho 1 seller

Implementado. OAuth + regra 1 seller. Sem dinheiro live.

## Fase 2 — sandbox split (código; sem live)

**Status:** implementado neste repo. **Não move dinheiro live.**

Decisão v2.1 (locked):

- Um vendedor por pedido. Carrinho misto → `400 MARKETPLACE_MIXED_CART` (PT) **sempre**.
- Loja própria `lojas-schimitz` permanece no collector da plataforma (sem self-split).
- PIX 5% absorvido pela **plataforma**: `application_fee = commissionAmount(chargeAmount, percent)` sobre o valor cobrado (PIX = 95%).
- Split sandbox só quando `ENABLED=true` **e** `ALLOW_LIVE=false` **e** credenciais `TEST-` **e** seller `linked` **e** não é a loja própria.
- `APP_ENV=production` + `APP_USR` → collector da plataforma (fail-closed). `ALLOW_LIVE=true` **não** abre caminho nesta fase.

O que a Fase 2 faz:

- `createIntent` sandbox: token do seller + `application_fee`.
- `Payment.splitMode=seller_oauth_v1`, `applicationFee`, `collectorMpUserId`.
- Webhook GET no collector do seller; `recordOnPaid` com `source=mp_application_fee`.
- Refund sandbox + `reverseOnRefund` (linhas `mp_application_fee` → `cancelled`).
- Admin esconde “Marcar pago” nessas linhas.
- Testes com HTTP MP **mockado**.

O que a Fase 2 **não** faz: `ALLOW_LIVE=true` em production, seed de vendedor fake em prod, Checkout Pro, multi-seller.

### Ops — checklist sandbox (staging only)

1. App MP **Marketplace** + `MP_MARKETPLACE_CLIENT_ID` / `CLIENT_SECRET` na API (não no web).
2. Redirect = `MP_MARKETPLACE_REDIRECT_URI`.
3. Tokens `TEST-` (plataforma e vendedor). Nunca `APP_USR` neste exercício.
4. `MP_SELLER_CREDENTIAL_KEY` (32 bytes).
5. Vendedor piloto real (KYC). Conectar em `/vendedor` com `ENABLED=true`.
6. `MP_MARKETPLACE_SPLIT_ENABLED=true` **só em staging**.
7. `MP_MARKETPLACE_SPLIT_ALLOW_LIVE=false` (unset ou false). **Não** ligar em production.
8. Pedido de teste PIX com 1 seller vinculado → MP sandbox. Conferir `Payment.splitMode` e ledger `source=mp_application_fee`.
9. **Não** este PR: ALLOW_LIVE / APP_USR / dinheiro real (Fase 3 + OK explícito).

Plano: [`MARKETPLACE-MP-SPLIT-PLAN.md`](./MARKETPLACE-MP-SPLIT-PLAN.md).

## v2 (Fase 3+)

- Split live (`ALLOW_LIVE`) — **não** neste PR; precisa OK explícito
- Relatórios de payout além do CSV
- Frete / disputa por vendedor
