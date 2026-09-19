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

> **Não há split automático / transfer / `application_fee` no pagamento.**  
> OAuth de vendedor existe na Fase 1 (flag off por padrão) e **não cobra**. O ledger continua a fonte do Repasse v1 (PIX manual).  
> Plano: [`MARKETPLACE-MP-SPLIT-PLAN.md`](./MARKETPLACE-MP-SPLIT-PLAN.md). **Nenhum passo de dinheiro live sem OK explícito.**

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
| **Split MP automático** | Fase 1 (OAuth + regra 1 seller) — **sem cobrança** | Ver [`MARKETPLACE-MP-SPLIT-PLAN.md`](./MARKETPLACE-MP-SPLIT-PLAN.md). `application_fee` / token de seller no payment = Fase 2+. |
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

## Fase 1 — OAuth + carrinho 1 seller (código; sem dinheiro)

**Status:** implementado neste repo. **Não move dinheiro.** `createIntent` continua no token da plataforma, sem `application_fee` / token de vendedor — mesmo se `MP_MARKETPLACE_SPLIT_ALLOW_LIVE=true` (fail-closed).

Decisão v2.1 (locked):

- Um vendedor por pedido. Carrinho misto → `400 MARKETPLACE_MIXED_CART` (PT) **sempre**, flags off também.
- Loja própria `lojas-schimitz` permanece no collector da plataforma (sem self-split / sem OAuth de vendedor).
- PIX 5% será absorvido pela **plataforma** no cálculo futuro da `application_fee` (Fase 2).
- Flag `MP_MARKETPLACE_SPLIT_ENABLED` (default **false**) só libera UI `/vendedor` “Conectar Mercado Pago” + persistência OAuth + job de refresh.

O que a Fase 1 faz:

- Schema aditivo: `Seller.mpUserId` / `mpPublicKey` / `mpOAuthStatus` / `mpTokenExpiresAt` + tabela `SellerMpCredential` (AES-256-GCM, chave `MP_SELLER_CREDENTIAL_KEY`).
- OAuth: `GET /seller/mp/connect` → redirect MP → `POST /seller/mp/callback` (code→token; HTTP real só com app MP; testes mockam HTTP).
- Job `MpOAuthRefreshService` (SchedulerLock) — no-op com flag off.
- Checkout / sacola: aviso PT + botão bloqueado se houver mais de um seller.

O que a Fase 1 **não** faz: `application_fee` em sandbox/live, `ALLOW_LIVE=true` cobrando, seed de vendedor fake em produção, Checkout Pro.

### Ops ainda necessários para a Fase 2

1. App Mercado Pago tipo **Marketplace** (não o app de pagamento simples atual) com `client_id` / `client_secret` no Railway da **API**.
2. Redirect OAuth idêntico a `MP_MARKETPLACE_REDIRECT_URI` (padrão `https://lojasschimitz.com.br/vendedor/mp/callback`).
3. Credenciais `TEST-` primeiro; `APP_USR` marketplace só depois, sem substituir o token atual sem rollback.
4. `MP_SELLER_CREDENTIAL_KEY` (32 bytes) para guardar tokens.
5. Vendedor piloto com conta MP + KYC (não seed).
6. Ligar `MP_MARKETPLACE_SPLIT_ENABLED=true` só em não-prod para testar OAuth.
7. **Gate de dinheiro (Fase 3):** `MP_MARKETPLACE_SPLIT_ALLOW_LIVE=true` em produção + primeiro payment com `application_fee` — precisa de OK explícito. Este PR não implementa esse caminho.

Plano: [`MARKETPLACE-MP-SPLIT-PLAN.md`](./MARKETPLACE-MP-SPLIT-PLAN.md).

## v2 (Fase 2+)

- Split sandbox (`application_fee` + token do seller) — **não** neste PR
- Relatórios de payout além do CSV
- Frete / disputa por vendedor
