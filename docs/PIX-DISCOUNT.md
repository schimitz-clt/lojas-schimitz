# PIX 5% — autoridade de preço

## Contrato

| Camada | Papel |
|--------|--------|
| `apps/web/src/lib/pricing.ts` | **Display only** na vitrine (ProductCard etc.). Não é fonte de verdade no checkout/pagamento. |
| `apps/api/src/common/pricing.ts` | **Autoridade** — `pixChargeAmount(orderTotal)` = 95% do total do pedido. `pixIntentChargeAmount` aplica o 5% automático **salvo** cupom colidente. |
| `PaymentsService.createIntent` | Se `method=pix`, `Payment.amount` = `pixIntentChargeAmount(Order.total, coupon.code)`. Cartão = `Order.total` cheio. |
| Webhook approve | Aceita `info.amount` == `Payment.amount` (já existia). Antes do cashback, aplica o 5% em `Order.discount` / `Order.total` para bater com o pago (no-op se o intent já cobrou o total cheio). |

## Vs SCH-002 / SCH-003

- SCH-002: total do pedido = subtotal − cupom − cashback + frete (sem PIX).
- SCH-003: intent/webhook usam o valor do Payment; mismatch se body≠truth do provedor.
- PIX 5% **não** altera o total no `POST /orders`; só no intent PIX e no approve.

## Anti-stack: cupom × PIX automático

O **5% automático no intent PIX** (`method=pix`) é a promo real “pague com PIX”. Cupons percentuais que duplicam isso (seed `PIX5`) **não empilham**.

- Constante: `PIX_PROMO_COLLIDING_COUPON_CODES = ['PIX5']` em `apps/api/src/common/pricing.ts`.
- Extra opcional: env CSV `PIX_PROMO_COLLIDING_COUPON_CODES` (ex.: `PIX5,PIX05`).
- Gate crítico: `createIntent` PIX. `POST /orders` / `POST /coupons/validate` **não** conhecem o método de pagamento (escolhido depois); cupom `PIX5` continua válido no cartão.
- `PIX5` está **aposentado** no seed (`active: false`). Não reative e **não crie** cupons % que copiem a promo PIX.

| Intent | Cupom | Valor cobrado |
|--------|--------|----------------|
| PIX | nenhum | 95% de `order.total` |
| PIX | `PIX5` (já baixou o pedido) | `order.total` (sem segundo 5%) |
| PIX | outro (ex. `OFF10`) | 95% do total pós-cupom |
| cartão | `PIX5` ou outro | `order.total` (inalterado) |

**Admin:** não criar cupom percentual que duplique o 5% PIX. Use o desconto automático no pagamento, ou um cupom que não seja a mesma promo.

## Exemplo

Pedido total R$ 100 (sem cupom) → PIX cobra R$ 95 → no approve: `discount += 5`, `total = 95` → cashback 1% sobre R$ 95.

## Marketplace split (Fase 2 sandbox)

A plataforma absorve o 5% no `application_fee`: a fee é `commissionAmount(chargeAmount, percent)` sobre o valor **cobrado**. Ex.: 10% de R$ 95 = **R$ 9,50** (não R$ 10,00 sobre o total cheio). Cartão (sem 5%) usa o total integral. Loja própria nunca faz split.

Pedido R$ 100 + cupom `PIX5` → `order.total` = R$ 95 → PIX cobra R$ 95 (não R$ 90,25). Cartão cobra R$ 95.
