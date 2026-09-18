# Security hardening reinforcement — 2026-09-18

**Base:** `main` including merged PR #40 (`feat(admin): falhas de e-mail pós-pago e reconciliações visíveis no Ops`).  
**Pedido:** endurecimento total / reforço (Security Pass 2026-09-17 + MASTER LOTE 4 residual).  
**Sem:** DNS, wipe de DB, auto-refund, Melhor Envio, Play Store, rotação de secrets, flip `REFRESH_JSON_TOKEN_ENABLED`, mudança de PIX/totals/stock.

## Hardened (this PR)

| Área | O que mudou | Como verificar |
|------|-------------|----------------|
| **Payments simulate / null webhook** | Produção **fail-closed**: `isProdLikeEnv()` considera `NODE_ENV`, `APP_ENV` **e** `RAILWAY_ENVIRONMENT`. `allowNullPaymentSimulate()` é sempre false nesse conjunto. `next build` **apaga** `NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE` e `NEXT_PUBLIC_NULL_WEBHOOK_SECRET` antes do bundle. A UI de simular só liga em `NODE_ENV !== production`. | Specs `payment.webhook-security`, `payment-simulate`, `strip-public-dev-flags`. Deploy: chunks da loja **sem** `NULL_WEBHOOK` / botão “Simular aprovação”. |
| **Storefront headers** | Permissions-Policy ampliada; `Cross-Origin-Opener-Policy: same-origin-allow-popups`; `Cross-Origin-Resource-Policy: same-origin`. CSP gradual **já existente** (Brick + Next `'unsafe-inline'`/`'unsafe-eval'`) **mantida** — não é nonce-strict. **COEP não enviada** (quebraria Brick). | `curl -sI https://lojasschimitz.com.br/` → HSTS, XFO, nosniff, Permissions-Policy, COOP, CORP, CSP. Checkout cartão: Brick ainda monta. |
| **Android WebView** | `allowFileAccess=false` (assets `file:///android_asset` continuam). Cleartext off, cookies 3P off, MP externo — preservados. | Source lock `android-webview-security.spec.ts`. App: offline.html ainda abre; PIX/checkout same-origin. |
| **Auth residual** | Cookie `sch_refresh` continua a preceder JSON; logout **sempre** `clearRefreshCookie` + web `credentials: 'include'`. Specs de source lock. **Não** flipamos `REFRESH_JSON_TOKEN_ENABLED`. | Login → Set-Cookie HttpOnly; logout → `Max-Age=0`. Admin 401 sem token. |
| **Admin / API** | IDOR 404 (não 403) com source locks em payments. Throttle extra: logout 30/min, PATCH `/me` 20/min, admin uploads 40/min. Global 100/min intacto. | `GET /api/v1/admin/orders` sem JWT → **401**. Uploads/admin ainda JWT+admin. |
| **Error leakage** | Filtro: prod-like (incl. Railway) ≥500 genérico; 4xx com path/stack → mensagem genérica. Sem campo `stack`. | Spec `http-exception.filter`. Live 401/404 sem paths `/workspace` / `.ts:`. |

## Deferred (explicit)

| Item | Por quê |
|------|---------|
| Redis / shared Throttler | Não está no stack — não inventar. Limite continua **por processo**. |
| CSP nonce-strict / Report-Only swap | Enforce gradual já cobre XSS básico **sem** quebrar Mercado Pago Card Brick. Nonce-only quebraria Next + Brick. |
| Cookie-only access JWT (`sch_access` fora do localStorage) | Residual XSS documentado (Phase 8 A2). Exige e2e web+Android. |
| `REFRESH_JSON_TOKEN_ENABLED=false` | Dual-mode intencional. Flip só no Railway **API** após e2e (checklist em `docs/SECURITY.md`). Este PR **não** altera o default. |
| Rotação de secrets / cliques no dashboard Railway | Humano. Checklist abaixo — não inventar valores. |
| Math de PIX / totals / stock / auto-refund | Fora de escopo (PRESERVE). |

## Railway checklist (humano — não executar daqui)

Serviço **web** (Next):

- [ ] Ausentes: `NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE`, `NEXT_PUBLIC_NULL_WEBHOOK_SECRET`
- [ ] Presente: `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` (pública, Brick)

Serviço **API**:

- [ ] `PAYMENTS_PROVIDER=mercadopago`
- [ ] `MERCADO_PAGO_ACCESS_TOKEN` + `MERCADO_PAGO_WEBHOOK_SECRET` fortes (≥16, fora da denylist)
- [ ] Ausentes: `ALLOW_NULL_PAYMENT_SIMULATE`, `ALLOW_NULL_PROVIDER_IN_PROD`, `NULL_WEBHOOK_SECRET`
- [ ] `REFRESH_JSON_TOKEN_ENABLED` — **não mudar** neste lote (unset/`true` = dual-mode)

Não rotacionar tokens neste PR. Não POST em webhook live.

## How to verify (sem cobrança)

```bash
# API
cd apps/api && npm run test:security

# Web
cd apps/web && npm run test:security

# Live headers (após deploy)
curl -sI https://lojasschimitz.com.br/ | grep -iE 'strict-transport|x-frame|content-security|permissions-policy|cross-origin'

# Admin gate
curl -s https://lojasschimitz.com.br/api/v1/admin/orders | head -c 400
# esperado: 401 Token ausente

# Brick: abrir um pedido unpaid (cartão) na vitrine — iframe Secure Fields carrega.
# Não pagar de verdade.
```

Detalhe de sessão / cookie: `docs/SECURITY.md` (SCH-006 + MASTER LOTE 4 + esta secção).
