# MEGA Phase 10 — commerce math + idempotency prep

**Data:** 2026-09-12 ~20:00 America/Sao_Paulo (UTC-3)  
**Base git:** `ceb82a2` (Phase 9 IDOR/BOLA + cookie-prefer refresh).  
**Commit SHA:** `10420b965e8ecf045e44b41e41cd24a84908fc7a`  
**Escopo:** auditoria de matemática de checkout/pedido/pagamento + assinatura/idempotência de webhook **sem cobranças reais**. Fixes só para bugs claros de money/idempotency.

## Resumo

| Área | Resultado |
|------|-----------|
| Autoridade de totais | `apps/api/src/common/pricing.ts` — `computeCheckoutTotals` + PIX 5% |
| Pedido (`OrdersService.create`) | Passa a usar `roundMoney` + `computeCheckoutTotals` (subtotal − cupom − cashback + frete) |
| Approve amount gate | `amountsMatchForApprove` — tolerância 1¢ vs `Payment.amount` **e** `Order.total` (corrige falso mismatch PIX float) |
| Webhook duplicate | Já coberto em `payment.webhook.db.spec.ts`; unitário novo `payment.webhook-idempotency.spec.ts` |
| Cobranças | **Nenhuma** (`PAYMENTS_PROVIDER=null` / sem MP live) |
| DB local Fase D | **SKIP** — `DATABASE_URL` ausente; sem Postgres em `127.0.0.1:5432` neste ambiente |

## Matemática (backend authority)

Fórmula de checkout (antes do PIX):

```
subtotal   = round(Σ price × qty)
coupon     = min(cupom, subtotal)          # CouponsService.validate
cashback   = min(pedido, subtotal − coupon)
freight    = ShippingProvider.quote.price  # já arredondado em shipping.rules
total      = round(max(0, subtotal − coupon − cashback + freight))
```

PIX 5% **não** entra no `POST /orders`. Entra em:

1. `PaymentsService.createIntent` → `Payment.amount = pixChargeAmount(Order.total)`  
2. `applyPixDiscountOnApprove` → dobra o 5% em `Order.discount` / `Order.total` quando o pago < total

Storefront `apps/web/src/lib/pricing.ts` permanece **display-only** (`docs/PIX-DISCOUNT.md`).

### Bug claro corrigido (money)

1. **Totais sem `roundMoney`** em `OrdersService.create` — risco de float (`0.1+0.2`) e inconsistência com cupom/frete.  
2. **Amount mismatch no approve** — ramo antigo só tolera vs `Order.total`; para PIX (`Payment.amount` = 95% do total) um valor provedor ≈95 com float podia rejeitar indevidamente. Agora `amountsMatchForApprove` usa `moneyEquals` contra **payment.amount** e **order.total**.

## Webhook signature + idempotency

| Controle | Evidência |
|----------|-----------|
| HMAC / secret fraco | `payment.webhook-security.spec.ts` |
| Unique `(provider, providerEventId)` | `PaymentsService.handleWebhook` + `payment.webhook.db.spec.ts` (`duplicate: true`) |
| Replay após `applied=true` | ignora + audit `payment.webhook_ignored_duplicate` |
| Evento persistido ainda `applied=false` | re-aplica (retry pós-crash) — documentado no unitário |
| Body ≠ verdade | webhook.db.spec `body_not_truth` |
| Out-of-order refused após paid | não regride status |

## Testes executados nesta sessão (UTC / box)

### Unitários (PASS)

- `pricing.spec.ts` (totais + cupom + PIX + amount gate)
- `payment.webhook-idempotency.spec.ts` (novo)
- `payment.webhook-security.spec.ts`
- `idempotency.spec.ts` / `concurrency.spec.ts`
- `coupons.validate.spec.ts` / `shipping.quote.spec.ts`
- `inventory.math.spec.ts` / `loyalty.math.spec.ts`
- `payment.status-machine|null|translate.spec.ts`
- `order-status.spec.ts` (via subset)

### DB / Fase D (SKIPPED — sem Postgres local)

Não rodados (ambiente sem `DATABASE_URL` localhost):

- `fase-d.db.spec.ts`
- `inventory.db.spec.ts`
- `payment.webhook.db.spec.ts`
- `pix-discount.db.spec.ts`
- `payment.integration.spec.ts`

**Plano quando DB local existir** (ver secção abaixo): migrate deploy em DB limpo `lojas_schimitz_fase_d`, seed, rodar os specs acima com `PAYMENTS_PROVIDER=null` e `ALLOW_NULL_PAYMENT_SIMULATE=true`. Sem Railway/produção.

## Plano de teste — concurrency / payment races

Objetivo: provar vencedor único e sem estoque negativo / sem double-apply, **sem cobrança real**.

| # | Cenário | Como | Esperado |
|---|---------|------|----------|
| R1 | 2× create última unidade | `fase-d.db.spec` / CAS inventory | 1 win; `qtyReserved` correto |
| R2 | Idempotency-Key replay mesmo payload | create order 2× | mesmo `orderId` |
| R3 | Idempotency-Key payload diferente | create order | `IDEMPOTENCY_KEY_REUSED` |
| R4 | 2× webhook mesmo `providerEventId` | `payment.webhook.db.spec` | 1ª aplica; 2ª `duplicate: true` |
| R5 | Webhook approve × cancel paralelo | CAS `awaiting_payment→paid` vs `→cancelled` | um vence; cancelado+aprovado → orphan refund path |
| R6 | 2× approve webhook eventos distintos após paid | out-of-order | order permanece `paid`; payment não regride |
| R7 | Intent PIX amount | `pix-discount.db.spec` | `Payment.amount = 95% Order.total`; card = 100% |
| R8 | Expire reservation × late approve | tick expiry + webhook | se cancelou primeiro: orphan approve + refund best-effort; se paid primeiro: expiry no-op |

Unitários estáticos já cobrem R1/R2/R3/R5 em `concurrency.spec.ts`. R4–R8 exigem Postgres local (harness null provider).

## Explicitamente NÃO feito

- Cobrança Mercado Pago / PIX live  
- Mutations destrutivas em DB de produção  
- Reverter ou alterar commits Phase 9  
- Instalar/provisionar Postgres neste box só para o harness  

## Artefatos

- `apps/api/src/common/pricing.ts` / `pricing.spec.ts`
- `apps/api/src/modules/orders/orders.service.ts` (wire totals)
- `apps/api/src/modules/payments/payments.service.ts` (amount gate)
- `apps/api/src/modules/payments/payment.webhook-idempotency.spec.ts`
- `apps/api/package.json` (test scripts)
