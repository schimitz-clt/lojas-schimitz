# Plano — Split automático Mercado Pago (Marketplace v2)

**Status:** Fase 3 implementada **no código**. Split live (`APP_USR` + `application_fee`) só dispara quando **todas** as flags abaixo estão ligadas. Merge deste PR **não** liga produção sozinho — precisa de segundo OK de deploy + flip de env no Railway pela ops.  
**Checkout:** Payments API (`POST /v1/payments`) + Card Payment Brick + PIX — **não** Checkout Pro.  
**Collector default:** `MERCADO_PAGO_ACCESS_TOKEN` da plataforma recebe 100% quando nenhum caminho de split está ativo.

> **OK EXPLÍCITO (2026-09-19):** Lucas/Rafael (Lojas Schimitz) autorizou o **código** do caminho live: *"Quero ligar o split automático LIVE em produção (OK financeiro explícito)"*.  
> Este documento **não** substitui o flip de env no Railway. `ALLOW_LIVE=true` em production continua sendo um passo de **ops**, depois do merge e de um segundo OK de deploy.

---

## 1. O que o repo faz hoje (âncora no código)

| Peça | Onde | Comportamento |
|---|---|---|
| Intent (default) | `MercadoPagoPaymentProvider.createIntent` | Token da plataforma, **sem** `application_fee`. |
| Intent (sandbox Fase 2) | mesmo método | Se ENABLED + ALLOW_LIVE=false + credenciais de teste (`TEST-` / APP_USR de staging) + seller `linked` + pedido 1 seller não-casa: Bearer do vendedor + `application_fee = commissionAmount(chargeAmount, percent)`. PIX: se o MP recusar a fee, **uma** retentativa sem fee no collector da plataforma (`splitMode=ledger_only`). |
| Intent (live Fase 3) | mesmo método | Se ENABLED + ALLOW_LIVE=true + produção/prod-like + credenciais **APP_USR** + seller `linked` + 1 seller não-casa: Bearer do vendedor + a mesma `application_fee`. |
| Token plataforma | `MERCADO_PAGO_ACCESS_TOKEN` / `MP_ACCESS_TOKEN` | Collector da loja própria e fallback. |
| Brick | `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` ou `Order.marketplaceSplit.bricksPublicKey` | Public key da mesma conta do token usado no intent. |
| Webhook | `POST /webhooks/mercadopago` | HMAC → GET payment (plataforma **ou** token do seller collector) → `applyProviderStatus`. |
| Pedido pago | `OrdersService.transitionFromAwaiting` (CAS) | `awaiting_payment` → `paid`. |
| Comissão | `CommissionsService.recordOnPaid` | Ledger por item. `source=mp_application_fee` no split OAuth; `pending_manual_or_pix_no_fee` se o PIX caiu no fallback sem fee. |
| Repasse v1 | Admin `PATCH /admin/commissions/:id/paid` | PIX manual. **Bloqueado** se `source=mp_application_fee`. |
| Refund | `POST /admin/payments/:id/refund` | Estorno integral; no split OAuth usa token do seller; **reverte** ledger `mp_application_fee` / `pending_manual_or_pix_no_fee`. |
| PIX 5% | `pixIntentChargeAmount` | Desconto da plataforma. `application_fee` é calculada sobre o **valor cobrado** (95%), não sobre o total cheio. |

Loja própria `lojas-schimitz`: **nunca** self-split.

Flags (default **false**):

| Flag | Efeito |
|---|---|
| `MP_MARKETPLACE_SPLIT_ENABLED` | OAuth + (com ALLOW_LIVE=false e credenciais de teste) sandbox `application_fee`; também é pré-requisito do caminho live. |
| `MP_MARKETPLACE_SPLIT_ALLOW_LIVE` | **Default false.** `true` abre o caminho live **somente** com ENABLED + produção/prod-like + APP_USR. Sozinha não faz nada. |

Produção (`APP_ENV=production`) + token `APP_USR` **sem** `ALLOW_LIVE`: caminho da plataforma (fail-closed), mesmo com ENABLED.

---

## 2. Como o MP Marketplace funciona (vs este checkout)

Documentação MP (Brasil): [Split payments](https://www.mercadopago.com.br/developers/en/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace) + [OAuth](https://www.mercadopago.com.br/developers/en/docs/security/oauth/creation).

Payments API: `POST /v1/payments` com **token do vendedor** + `application_fee` (BRL absoluto).  
MP cobra a taxa MP primeiro; a fee sai do restante. Plataforma recebe a fee; vendedor recebe o líquido.

v2.1: **um seller por pedido**. Carrinho misto → `MARKETPLACE_MIXED_CART` (PT).

### PIX 5% (locked)

A plataforma absorve o 5% no cálculo da fee: `application_fee = commissionAmount(chargeAmount, percent)` e `chargeAmount` PIX já é 95% de `order.total` (salvo cupom colidente). Ex.: total 100, PIX 95, 10% → fee **9,50** (não 10,00).

---

## 3. Pré-requisitos (ops + MP)

1. App MP tipo **Marketplace** + redirect OAuth.
2. Credenciais **TEST-** / APP_USR de teste em staging. Não misturar o token live de produção no sandbox.
3. `client_id` / `client_secret` só na API (Railway).
4. Vendedor piloto real com KYC (não seed fake em prod).
5. `MP_SELLER_CREDENTIAL_KEY` (32 bytes).
6. Webhook atual (`PUBLIC_API_URL` + `/webhooks/mercadopago`) — o handler tenta o collector do seller se o GET da plataforma falhar.

---

## 4. Modelo de dados

Schema aditivo (Fase 1 + 2 + 3; sem migration nova nesta fase):

```text
Seller              mpUserId, mpPublicKey, mpOAuthStatus, mpTokenExpiresAt
SellerMpCredential  accessTokenEnc, refreshTokenEnc
Payment             collectorMpUserId, applicationFee, splitMode (off|seller_oauth_v1|ledger_only)
CommissionLedger    source (manual_pix|mp_application_fee|pending_manual_or_pix_no_fee), mpPaymentId, mpApplicationFee
```

---

## 5. Feature flag e rollback

1. Sem ENABLED **ou** seller não linked **ou** loja própria → token da loja, sem fee.
2. Sandbox: ALLOW_LIVE=false + credenciais de teste. Rollback de sandbox: `ENABLED=false`.
3. Live: ALLOW_LIVE=true + ENABLED + produção/prod-like + APP_USR. **Rollback live: `MP_MARKETPLACE_SPLIT_ALLOW_LIVE=false`** no Railway production (volta ao collector da plataforma, fail-closed). Pedidos já splittados no MP continuam como foram capturados.
4. Fail-closed: split decidido mas token do seller ilegível → **não** cobra no token da loja; falha o intent (`SELLER_TOKEN_UNAVAILABLE`).
5. Produção sem ALLOW_LIVE continua fail-closed (Fase 2).

---

## 6. Gates de dinheiro

### **[OK EXPLÍCITO 2026-09-19] — Fase 3: código do payment live com `application_fee`**

Código neste repo: `ALLOW_LIVE=true` **pode** enviar fee em production quando as outras gates estão abertas.

**Ainda precisa (ops, não este PR):**

1. Segundo OK de deploy após o merge.
2. Flip no Railway **production** (serviço da API):
   - `MP_MARKETPLACE_SPLIT_ENABLED=true`
   - `MP_MARKETPLACE_SPLIT_ALLOW_LIVE=true`
   - `APP_ENV=production` (ou Railway environment = production)
   - `MERCADO_PAGO_ACCESS_TOKEN` / seller OAuth = `APP_USR-…` live (não `TEST-`)
3. Vendedor piloto real linked (sem seed fake).
4. Conferir o primeiro POST live (cartão preferencial) + webhook + refund.

**Pode** (staging, ALLOW_LIVE=false): OAuth, sandbox createIntent, webhook/refund sandbox, testes mockados. CI **não** cobra dinheiro real.

**Não fazer neste PR:** ligar as env vars no Railway; seed de vendedor fake em prod; Checkout Pro; multi-seller.

---

## 7. Fases

### Fase 0 — papel — **FEITO**
### Fase 1 — OAuth + 1 seller — **FEITO**
### Fase 2 — sandbox split — **FEITO**
### Fase 3 — produção live `application_fee` — **FEITO (código; env Railway ainda off)**

- createIntent live: seller token APP_USR + `application_fee` (mesmas regras PIX 5% / `commissionAmount`).
- Sandbox inalterado (`ALLOW_LIVE=false` + credenciais de teste).
- ALLOW_LIVE=false **nunca** usa o caminho live. ENABLED=false **nunca** envia fee. Loja própria **nunca** self-split. Produção sem ALLOW_LIVE continua fail-closed.
- PIX live: se o MP recusar `application_fee` ou credenciais live → **uma** retentativa `ledger_only` + QR na plataforma + comissão pendente (`pending_manual_or_pix_no_fee`). **Não** é take silencioso de 100%: o modo fica explícito e o vendedor deve ser pago via ledger. Cartão live que o MP recusar a fee **falha** o intent (PT: tente outro cartão ou PIX) — não assenta 100% na plataforma.
- **Aviso alto:** PIX live **pode não** fazer split automático de caixa no MP. O QR continua funcionando; o cash pode cair 100% na conta da plataforma até o repasse manual.

### Fase 4 — multi-seller / Pro / disputa — depois

---

## 8. Decisão locked (v2.1)

1. Modelo A — um seller por pedido; carrinho misto bloqueado (PT).
2. PIX 5% absorvido pela **plataforma** no cálculo da `application_fee`.
3. Loja própria `lojas-schimitz` **nunca** faz self-split.
4. Fase 2: só sandbox / credenciais de teste. Sem live money sem ALLOW_LIVE.
5. Fase 3: live money só com ENABLED + ALLOW_LIVE + prod-like + APP_USR.

---

## 9. PIX e `application_fee` (admin / vendedor)

O PIX **pode recusar** `application_fee` (`You cannot use application_fee with this payment.`). Cartão costuma aceitar. Causa comum no Brasil: o app MP ainda é **Checkout Pro**, não modelo **Marketplace** (painel MP → Produto integrado).

Se o MP recusar a fee no PIX (`application_fee` ou `Unauthorized use of live credentials`), o checkout tenta **uma vez** sem `application_fee` no collector da plataforma e grava a % no ledger (`splitMode=ledger_only`, `source=pending_manual_or_pix_no_fee`). O cliente ainda vê o QR. O vendedor **não** recebe o líquido automaticamente no MP — ops paga via ledger (Repasse v1).

Isso vale em staging **e** no caminho live. Documentado de propósito: live PIX pode não auto-split cash no MP.

---

## 10. Checklist Railway production (ops — depois do merge + segundo OK)

Valores default no repo / `.env.example` continuam `false`. Flip **só** no painel Railway do serviço da API:

| Variável | Staging (sandbox) | Production (live) | Rollback live |
|---|---|---|---|
| `MP_MARKETPLACE_SPLIT_ENABLED` | `true` | `true` | `true` (OAuth permanece) ou `false` |
| `MP_MARKETPLACE_SPLIT_ALLOW_LIVE` | `false` | `true` | **`false`** |
| `APP_ENV` | `staging` | `production` | `production` |
| `MERCADO_PAGO_ACCESS_TOKEN` | `TEST-` ou APP_USR de teste | `APP_USR-` live | sem mudança |
| Seller OAuth | credenciais de teste | `APP_USR-` live do vendedor | sem mudança |

Rollback imediato: `MP_MARKETPLACE_SPLIT_ALLOW_LIVE=false`. Novos intents voltam ao collector da plataforma. Não apaga payments já splittados.

Não semear vendedor fake. Não cobrar em CI.
