# Plano — Split automático Mercado Pago (Marketplace v2)

**Status:** Fase 2 implementada (sandbox split). **Nenhum caminho de produção live (`APP_USR` + `ALLOW_LIVE`) envia `application_fee`.**  
**Checkout:** Payments API (`POST /v1/payments`) + Card Payment Brick + PIX — **não** Checkout Pro.  
**Collector default:** `MERCADO_PAGO_ACCESS_TOKEN` da plataforma recebe 100% quando o split sandbox **não** está ativo.

> **GATE DE DINHEIRO:** qualquer passo marcado **[OK EXPLÍCITO]** abaixo **não pode** ser executado em produção sem autorização da pessoa dona da conta MP / loja. Este documento **não** autoriza ligar `MP_MARKETPLACE_SPLIT_ALLOW_LIVE=true` em production.

---

## 1. O que o repo faz hoje (âncora no código)

| Peça | Onde | Comportamento |
|---|---|---|
| Intent (default) | `MercadoPagoPaymentProvider.createIntent` | Token da plataforma, **sem** `application_fee`. |
| Intent (sandbox Fase 2) | mesmo método | Se ENABLED + ALLOW_LIVE=false + credenciais `TEST-` / APP_USR de staging + seller `linked` + pedido 1 seller não-casa: Bearer do vendedor + `application_fee = commissionAmount(chargeAmount, percent)`. PIX: se o MP recusar a fee, **uma** retentativa sem fee no collector da plataforma (`splitMode=ledger_only`). |
| Token plataforma | `MERCADO_PAGO_ACCESS_TOKEN` / `MP_ACCESS_TOKEN` | Collector da loja própria e fallback. |
| Brick | `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` ou `Order.marketplaceSplit.bricksPublicKey` (TEST- do seller) | Public key da mesma conta do token usado no intent. |
| Webhook | `POST /webhooks/mercadopago` | HMAC → GET payment (plataforma **ou** token do seller collector) → `applyProviderStatus`. |
| Pedido pago | `OrdersService.transitionFromAwaiting` (CAS) | `awaiting_payment` → `paid`. |
| Comissão | `CommissionsService.recordOnPaid` | Ledger por item. `source=mp_application_fee` no split sandbox; `pending_manual_or_pix_no_fee` se o PIX caiu no fallback sem fee. |
| Repasse v1 | Admin `PATCH /admin/commissions/:id/paid` | PIX manual. **Bloqueado** se `source=mp_application_fee`. |
| Refund | `POST /admin/payments/:id/refund` | Estorno integral; no split sandbox usa token do seller; **reverte** ledger `mp_application_fee` (status `cancelled`). |
| PIX 5% | `pixIntentChargeAmount` | Desconto da plataforma. `application_fee` é calculada sobre o **valor cobrado** (95%), não sobre o total cheio. |

Loja própria `lojas-schimitz`: **nunca** self-split.

Flags (default **false**):

| Flag | Efeito Fase 2 |
|---|---|
| `MP_MARKETPLACE_SPLIT_ENABLED` | OAuth + (com TEST- e ALLOW_LIVE=false) sandbox `application_fee`. |
| `MP_MARKETPLACE_SPLIT_ALLOW_LIVE` | **Deixe false.** `true` **não** liga split (fail-closed até Fase 3). |

Produção (`APP_ENV=production`) + token `APP_USR`: caminho da plataforma mesmo com ENABLED.

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
2. Credenciais **TEST-** em staging. Não substituir o token live de produção.
3. `client_id` / `client_secret` só na API (Railway).
4. Vendedor piloto real com KYC (não seed fake em prod).
5. `MP_SELLER_CREDENTIAL_KEY` (32 bytes).
6. Webhook atual (`PUBLIC_API_URL` + `/webhooks/mercadopago`) — o handler tenta o collector do seller se o GET da plataforma falhar.

---

## 4. Modelo de dados

Schema aditivo (Fase 1 + 2):

```text
Seller              mpUserId, mpPublicKey, mpOAuthStatus, mpTokenExpiresAt
SellerMpCredential  accessTokenEnc, refreshTokenEnc
Payment             collectorMpUserId, applicationFee, splitMode (off|seller_oauth_v1|ledger_only)
CommissionLedger    source (manual_pix|mp_application_fee|pending_manual_or_pix_no_fee), mpPaymentId, mpApplicationFee
```

---

## 5. Feature flag e rollback

1. Sem ENABLED **ou** seller não linked **ou** loja própria → token da loja, sem fee.
2. ALLOW_LIVE=true → **não** envia fee (Fase 2). Rollback de sandbox: `ENABLED=false`.
3. Fail-closed: sandbox decidido mas token do seller ilegível → **não** cobra no token da loja; falha o intent (`SELLER_TOKEN_UNAVAILABLE`).
4. Pedidos já splittados no MP continuam como foram capturados.

---

## 6. Gates de dinheiro — o que espera OK explícito

### **[OK EXPLÍCITO] — Fase 3: primeiro payment live com `application_fee`**

Inclui: `ALLOW_LIVE=true` em Railway **production**, credentials `APP_USR` marketplace, primeiro POST live com fee / token de vendedor, refund/chargeback live de payment splittado.

**Pode** (staging, `TEST-`, ALLOW_LIVE=false): OAuth, sandbox createIntent, webhook/refund sandbox, testes mockados.

**Não fazer neste PR / Fase 2:** ligar ALLOW_LIVE em produção; documentar como ligar ALLOW_LIVE em produção; seed de vendedor fake em prod.

---

## 7. Fases

### Fase 0 — papel — **FEITO**
### Fase 1 — OAuth + 1 seller — **FEITO**
### Fase 2 — sandbox split — **FEITO (este PR)**

- createIntent sandbox: seller token + `application_fee`.
- Carrinho misto PT (API + UI com nomes).
- Webhook resolve collector do seller; `recordOnPaid` `source=mp_application_fee`.
- Refund sandbox + reversão de ledger.
- PIX 5% + arredondamento testados (HTTP MP mockado).

### Fase 3 — **[OK EXPLÍCITO]** produção — **NÃO NESTE PR**
### Fase 4 — multi-seller / Pro / disputa — depois

---

## 8. Decisão locked (v2.1)

1. Modelo A — um seller por pedido; carrinho misto bloqueado (PT).
2. PIX 5% absorvido pela **plataforma** no cálculo da `application_fee`.
3. Loja própria `lojas-schimitz` **nunca** faz self-split.
4. Fase 2: só sandbox / TEST- (e APP_USR de teste em staging). Sem live money.

---

## 9. PIX e `application_fee` (admin / vendedor)

O PIX **pode recusar** `application_fee` (`You cannot use application_fee with this payment.`). Cartão costuma aceitar. Causa comum no Brasil: o app MP ainda é **Checkout Pro**, não modelo **Marketplace** (painel MP → Produto integrado).

Em staging, se o MP recusar a fee no PIX, o checkout tenta **uma vez** sem `application_fee` no collector da plataforma e grava a % no ledger (`splitMode=ledger_only`, `source=pending_manual_or_pix_no_fee`). O cliente ainda vê o QR. Isso **não** liga split live e **não** usa `ALLOW_LIVE`.
