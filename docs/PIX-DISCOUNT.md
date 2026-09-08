# PIX 5% — autoridade de preço

## Contrato

| Camada | Papel |
|--------|--------|
| `apps/web/src/lib/pricing.ts` | **Display only** na vitrine (ProductCard etc.). Não é fonte de verdade no checkout/pagamento. |
| `apps/api/src/common/pricing.ts` | **Autoridade** — `pixChargeAmount(orderTotal)` = 95% do total do pedido. |
| `PaymentsService.createIntent` | Se `method=pix`, `Payment.amount` = `pixChargeAmount(Order.total)` e o provedor cobra esse valor. Cartão = `Order.total` cheio. |
| Webhook approve | Aceita `info.amount` == `Payment.amount` (já existia). Antes do cashback, aplica o 5% em `Order.discount` / `Order.total` para bater com o pago. |

## Vs SCH-002 / SCH-003

- SCH-002: total do pedido = subtotal − cupom − cashback + frete (sem PIX).
- SCH-003: intent/webhook usam o valor do Payment; mismatch se body≠truth do provedor.
- PIX 5% **não** altera o total no `POST /orders`; só no intent PIX e no approve.

## Exemplo

Pedido total R$ 100 → PIX cobra R$ 95 → no approve: `discount += 5`, `total = 95` → cashback 1% sobre R$ 95.
