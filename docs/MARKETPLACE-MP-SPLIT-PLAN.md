# Plano — Split automático Mercado Pago (Marketplace v2)

**Status:** Fase 1 implementada (OAuth + schema + carrinho 1 seller). **Nenhum código deste repo cria split, transfer ou payment com `application_fee`.**  
**Checkout atual:** Payments API (`POST /v1/payments`) + Card Payment Brick + PIX — **não** Checkout Pro.  
**Collector atual:** um único `MERCADO_PAGO_ACCESS_TOKEN` da plataforma recebe 100% de `transaction_amount`.

> **GATE DE DINHEIRO:** qualquer passo marcado **[OK EXPLÍCITO]** abaixo **não pode** ser executado em produção sem autorização da pessoa dona da conta MP / loja. Este documento não autoriza cobrança, estorno, transfer ou troca de token live.

---

## 1. O que o repo faz hoje (âncora no código)

| Peça | Onde | Comportamento |
|---|---|---|
| Intent | `MercadoPagoPaymentProvider.createIntent` | Um `POST https://api.mercadopago.com/v1/payments` com `transaction_amount`, `external_reference = Order.publicId`, `payer.email`, PIX ou `token` de cartão. **Sem** `application_fee`, `marketplace_fee`, `collector_id`, `sponsor_id`, disbursements. |
| Token | `MERCADO_PAGO_ACCESS_TOKEN` / `MP_ACCESS_TOKEN` | Bearer único da loja. |
| Brick | `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` | Public key da **mesma** conta (frontend). |
| Webhook | `POST /webhooks/mercadopago` | HMAC `x-signature` → `GET /v1/payments/{id}` → `applyProviderStatus`. Fonte da verdade é o GET, não o body. |
| Pedido pago | `OrdersService.transitionFromAwaiting` (CAS) | `awaiting_payment` → `paid`. |
| Comissão | `CommissionsService.recordOnPaid` | Ledger interno por `OrderItem.sellerId`. **Não move dinheiro.** Idempotente em `orderItemId`. Retry se o CAS perder e o pedido já estiver `paid`. |
| Repasse v1 | Admin `PATCH /admin/commissions/:id/paid` | PIX manual + `payoutReference`. |
| Refund | `POST /admin/payments/:id/refund` → `POST /v1/payments/{id}/refunds` | Estorno **integral** do payment. Sem reversão de ledger / cashback. |
| Chargeback | `translateStatus('charged_back')` → `unknown` | Sem workflow. `in_mediation` fica `pending`. |
| Índice | `Payment` pending único por pedido | Um intent pendente por order — incompatível com N charges MP sem mudança de schema. |
| PIX 5% | `pixIntentChargeAmount` no **total do pedido** | Desconto da plataforma no valor cobrado. |

`Seller.commissionPercent` é stub de ledger (“não usado no checkout”). Não há `mpUserId`, OAuth, refresh token nem tabela de split.

`PAYMENTS_PROVIDER=null` é só adapter de teste/local. **Não** é evidência de marketplace.

Flags em `.env.example` (default **false**): `MP_MARKETPLACE_SPLIT_ENABLED` libera só OAuth/UI/job; `MP_MARKETPLACE_SPLIT_ALLOW_LIVE` está documentado e **o provider não lê** — de propósito (Fase 1 fail-closed).

---

## 2. Como o MP Marketplace funciona (vs este checkout)

Documentação MP (Brasil): [Split payments](https://www.mercadopago.com.br/developers/en/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace) + [OAuth](https://www.mercadopago.com.br/developers/en/docs/security/oauth/creation).

1. App MP tipo **Marketplace** (não o app “pagamento simples” atual).
2. Cada vendedor autoriza via OAuth (`authorization` → `POST /oauth/token`).
3. Resposta: `access_token` do vendedor, `refresh_token` (180 dias; renovar e **guardar o novo refresh**), `user_id` = `collector_id`, `public_key` do vendedor.
4. No pagamento:
   - **Checkout Transparente / Payments API** (o que temos): `POST /v1/payments` com **token do vendedor** + `application_fee` (valor absoluto da comissão da plataforma, em BRL).
   - **Checkout Pro** (não usamos): `POST /checkout/preferences` com `marketplace_fee`. Migrar para Pro **não** é pré-requisito e **não** deve ser o primeiro passo — quebraria Brick + PIX atuais.
5. MP cobra a taxa MP **primeiro**; a `application_fee` sai do restante. O vendedor recebe o líquido na conta dele. A plataforma recebe a fee na conta marketplace.

Isso é **split na captura**, não “transfer depois”. Transfer API / saque posterior seria um desenho diferente (mais risco, mais reconciliação) — **não** é o caminho recomendado para v2.

### Implicação para um pedido multi-seller

Hoje: 1 pedido, 1 payment, 1 collector.

No modelo MP 1:1 (um seller token por payment):

- **Opção A (recomendada para v2.1):** um pedido só pode ter **um** `sellerId` (ou só loja própria). Split = 1 payment no token do seller + `application_fee`. Carrinho misto bloqueado no checkout com mensagem clara.
- **Opção B (v2.2+):** N payments (um por seller) **ou** API de split avançado se/quando a conta MP oferecer disbursements multi-collector. Exige relaxar `Payment_one_pending_per_order`, UX de `/pedidos/{publicId}` e webhooks.

**Não** implementar B no primeiro PR.

PIX 5%: definir se o desconto come a fee da plataforma, o líquido do seller, ou só SKUs da loja própria. Sem essa regra, o valor de `application_fee` vs `transaction_amount` fica errado.

---

## 3. Pré-requisitos (ops + MP, antes de código de dinheiro)

1. Conta Mercado Pago **Marketplace** (PJ), app com redirect OAuth `https://lojasschimitz.com.br/…`.
2. Credenciais de **teste** (`TEST-`) e, só depois, `APP_USR` marketplace — **não** substituir o token de produção atual sem rollback.
3. `client_id` / `client_secret` do app marketplace (Railway, só API; nunca no web `NEXT_PUBLIC_*`).
4. Vendedor real com conta MP + KYC aprovado (não seed fake).
5. Webhooks: manter payment topic; avaliar `merchant_order`, chargebacks, money_release. A URL atual (`PUBLIC_API_URL` + `/webhooks/mercadopago`) continua; o handler precisa distinguir payment da plataforma vs payment do seller.
6. Contrato interno: % de comissão = `Seller.commissionPercent` (já no admin) ↔ `application_fee` em BRL no momento do intent.
7. Sandbox: um pagamento de teste **sem** `ALLOW_LIVE`.

---

## 4. Modelo de dados vs `CommissionLedger`

**Manter o ledger.** Ele é a fonte operacional do Repasse v1 e deve continuar existindo como reconciliação.

Sugestão **aditiva** (não aplicar até a fase 2 do código, e mesmo assim sem mover dinheiro):

```text
Seller
  + mpUserId          String?     // collector_id
  + mpPublicKey       String?
  + mpOAuthStatus     pending|linked|expired|revoked
  + mpTokenExpiresAt  DateTime?

SellerMpCredential (tabela à parte, criptografada / envelope)
  accessTokenEnc, refreshTokenEnc, updatedAt

Payment
  + collectorMpUserId String?
  + applicationFee    Decimal?    // snapshot
  + splitMode         off|seller_oauth_v1

CommissionLedger
  + source            manual_pix|mp_application_fee
  + mpPaymentId       String?
  + mpApplicationFee  Decimal?
```

Quando o split live estiver ligado **e** o payment tiver `applicationFee`:

- `recordOnPaid` ainda grava a linha (auditoria).
- `source=mp_application_fee` — admin **não** marca PIX manual nesse caso (UI deve esconder “Marcar pago” ou exigir override).
- Refund: precisa **reverter** ou cancelar o ledger (hoje não faz).

Rollback de schema: colunas nullable; flag off ignora as colunas.

---

## 5. Feature flag e rollback

| Flag | Default | Efeito desejado (quando implementado) |
|---|---|---|
| `MP_MARKETPLACE_SPLIT_ENABLED` | `false` | Permite **código** OAuth + validação em staging. **Não** envia `application_fee`. |
| `MP_MARKETPLACE_SPLIT_ALLOW_LIVE` | `false` | Único interruptor que autoriza `application_fee` / token de seller em `APP_ENV=production`. |

Regras:

1. Sem os dois flags + seller `mpOAuthStatus=linked` + pedido single-seller → caminho **atual** (token da loja, sem fee).
2. Token marketplace **não** substitui `MERCADO_PAGO_ACCESS_TOKEN` da loja própria até o cutover.
3. Rollback: `MP_MARKETPLACE_SPLIT_ALLOW_LIVE=false` (ou unset). Payments novos voltam ao collector único. Ledger manual permanece. Pedidos já splittados continuam no MP como foram capturados — rollback **não** desfaz split já liquidado.
4. Fail-closed: se o flag live estiver on mas o seller não tiver token válido → **não** cobrar no token da loja “como se fosse split”. Falhar o intent com erro claro.

Hoje esses flags **não estão ligados** no `createIntent`. Colocá-los no `.env.example` é só reserva documental.

---

## 6. Gates de dinheiro — o que espera OK explícito

Um único passo de produção que move dinheiro de verdade:

### **[OK EXPLÍCITO] — Ligar o primeiro payment live com `application_fee` / token de seller**

Isso inclui (são o mesmo gate, não “vários OKs escondidos”):

- Setar `MP_MARKETPLACE_SPLIT_ALLOW_LIVE=true` em Railway **production**.
- Trocar ou adicionar credentials `APP_USR` de app Marketplace na API de produção.
- Criar o **primeiro** `POST /v1/payments` live com `application_fee` ou access token de vendedor.
- Primeiro refund / chargeback de um payment já splittado.
- Qualquer transfer / saque / `money_release` manual via API.

**Pode** ser feito sem esse OK (ainda assim em staging/teste, tokens `TEST-`):

- Escrever o plano (este arquivo).
- Flags default false.
- Schema nullable + UI OAuth **desligada**.
- Testes com NullProvider / MP sandbox.

**Não fazer agora (mesmo em PR):** alterar `createIntent` para enviar `application_fee` “atrás de um if”. Um env errado em produção cobraria errado.

---

## 7. Fases de implementação (depois do OK do plano)

### Fase 0 — só papel (esta entrega)

- Fechar v1 com evidência.
- Este plano.
- Sem OAuth routes, sem colunas, sem mudança no body MP.

### Fase 1 — OAuth + dados (ainda sem dinheiro) — **FEITO**

- Schema aditivo Seller MP + `SellerMpCredential` (AES-256-GCM).
- `/vendedor` botão “Conectar Mercado Pago” (gated; default hidden).
- Refresh job do `refresh_token` (SchedulerLock; no-op com flag off).
- Flag `MP_MARKETPLACE_SPLIT_ENABLED` só libera a UI de vínculo.
- Carrinho misto → `MARKETPLACE_MIXED_CART` (sempre).
- Testes de troca de code → token **mockando HTTP**, sem charge.
- **Ops (fora do código):** app MP Marketplace + redirect + `client_id`/`client_secret` + `MP_SELLER_CREDENTIAL_KEY`.

### Fase 2 — sandbox split (ainda sem live)

- Checkout: se 1 seller + linked + flag enabled + **não** prod-like (ou `ALLOW_LIVE` false): `createIntent` usa token do seller + `application_fee = commissionAmount(chargeAmount, percent)`.
- Carrinho misto → 400 `MARKETPLACE_MIXED_CART` (mensagem PT).
- Webhook: resolver payment pelo `externalId` do seller; `recordOnPaid` com `source=mp_application_fee`.
- Refund sandbox + reversão de ledger.
- PIX 5%: regra escrita + testes de arredondamento.

### Fase 3 — **[OK EXPLÍCITO]** produção

- Um seller piloto (não a loja própria no primeiro dia, se possível).
- `ALLOW_LIVE=true` só na API.
- Monitorar `PaymentReconciliation`, ledger vs MP, e-mail de venda.
- Rollback = desligar `ALLOW_LIVE`.

### Fase 4 — multi-seller / Pro / disputa (depois)

- N collectors ou Checkout Pro — **só** se a Fase 3 estiver estável.
- Chargeback por seller.
- Frete por seller (domínio separado).

---

## 8. O que ainda precisa de OK do usuário para a Parte B

Antes de **qualquer** implementação de Fase 1+:

1. Confirmar o modelo **A** (um seller por pedido no v2.1) vs aceitar bloquear carrinho misto.
2. Confirmar quem absorve o PIX 5% no split.
3. Confirmar % padrão (hoje 10% no ledger) e se a loja própria (`lojas-schimitz`) **nunca** faz split (continua collector da plataforma).
4. Criar/confirmar app MP Marketplace + redirect URL (ops).
5. Escolher o vendedor piloto (conta MP real, não seed).
6. **O gate único de dinheiro:** autorização para o primeiro payment live com split (`ALLOW_LIVE`).

Até esses OKs, o caminho correto é **Repasse v1 (PIX manual)** + este plano.

---

## 9. Decisão locked (v2.1) + estado da Fase 1

Decisão do usuário (locked):

1. Modelo **A** — um seller por pedido; carrinho misto bloqueado (PT).
2. PIX 5% absorvido pela **plataforma** no cálculo futuro da `application_fee`.
3. Loja própria `lojas-schimitz` **nunca** faz self-split (collector da plataforma).
4. Só Fase 1 agora — sem dinheiro live.

Estado do código:

- OAuth + credencial criptografada + job de refresh + regra de carrinho: **sim**.
- `application_fee` / token de seller em `createIntent`: **não** (fail-closed; `ALLOW_LIVE` não abre caminho).
- Gate único de dinheiro (Fase 3) continua exigindo OK explícito.
