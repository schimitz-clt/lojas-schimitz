# Cupons (sacola + checkout)

Desconto real de código (percentual ou valor fixo). Sem mock, sem % inventado em produto.

## Deploy — migration obrigatória

**Este PR inclui migration aditiva** `prisma/migrations/20260920_cart_coupon_code`:

```sql
ALTER TABLE "Cart" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
```

O `start` de produção já roda `prisma migrate deploy`. Se o deploy não rodar migrate, o GET/POST de cupom na sacola quebra (coluna ausente). **Não é destrutiva** — só adiciona coluna nullable.

O model `Coupon` (code, type, value, active, minSubtotal, maxUses, endsAt, used/reserved) já existia (`20260905_sch004_coupons_cashback`). `endsAt` = validade (`expiresAt` no briefing).

## Como criar o piloto SCHIMITZ10

1. **Admin → Cupons:** código `SCHIMITZ10`, tipo percentual, valor `10`, ativo.
2. **Seed:** `cd apps/api && npm run prisma:seed` faz upsert de `SCHIMITZ10` (10%, ativo). `update: {}` — não sobrescreve toggle/validade já editados em produção.
3. PIX5 continua aposentado (`active: false`) e colidente com o 5% automático do PIX.

## Fluxo

| Onde | O que acontece |
|------|----------------|
| Sacola `/carrinho` | Input **Cupom** → `POST /cart/coupon` persiste o código no carrinho. Linha de desconto + total. **Remover** → `DELETE /cart/coupon`. |
| Checkout `/checkout` | Mesmo campo; hidrata o cupom da sacola. Total = subtotal − cupom − SCHIMITZ+ + frete. |
| `POST /orders` | Revalida o código (`couponCode` no body **ou** o persistido no cart). Reserva o cupom. Recusa inválido / expirado / inativo / abaixo do mínimo / esgotado. |
| Pagamento | PIX 5% automático **não empilha** com códigos colidentes (`PIX5`). |

Validação é idempotente: aplicar o mesmo código de novo só revalida e mantém o persistido.

## Fora de escopo

Mercado Pago / split, wishlist, busca/home/PDP, Play Store.
