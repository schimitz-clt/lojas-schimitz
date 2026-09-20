# Home shelves — Ofertas / Novidades / Mais vendidos

**Escopo:** vitrine home abaixo dos banners. Additive. Sem mock, sem % inventado.

## Endpoint

`GET /api/v1/store/shelves` → `{ shelves: HomeShelf[] }`

Cada rail: `{ id, title, subtitle, href, linkLabel, metric, items }`.
`items` usa o mesmo serialize público de `GET /products` (foto, preço, PIX 5% no card).
Rails sem produto **não vêm na resposta**; a home também esconde carousel vazio.

## Semântica honesta

| Rail | Título | O que significa de verdade | `metric` |
|------|--------|----------------------------|----------|
| Ofertas | **Ofertas** | Produtos com `compareAtPrice > price` (desconto real vs. de →) **ou** `badge` do catálogo. Sem promoção: **menores preços ativos** (subtítulo “Menores preços do catálogo”). O card só mostra `-X%` quando `compareAtPrice` é maior que o preço. | `deal` ou `lowest_price` |
| Novidades | **Novidades** | Mais novos por `createdAt` desc. | `createdAt` |
| Destaques | **Mais vendidos** só com dado real | 1) soma de `OrderItem.qty` em pedidos com status de receita paga (`PAID_REVENUE_STATUSES`); 2) se não houver vendas, `ratingCount > 0` (avaliações publicadas — subtítulo admite que ainda não há volume de pedidos); 3) se não houver vendas nem avaliações, título vira **Em destaque** (subtítulo “Destaques recentes do catálogo”). Nunca rotula “Mais vendidos” sem pedido pago ou avaliação. | `paid_qty` / `rating_count` / `newest` |

## Vitrine

- Cards: `ProductCard` existente (foto real, nome curto, preço, hint PIX 5%).
- Carousel horizontal com `scroll-snap` (mobile-first; setas no desktop).
- Alturas iguais; overflow horizontal só no trilho — a página não rola no eixo X.
- Fallback da home: se `/store/shelves` falhar, monta as rails a partir de `GET /products` (sem qty de pedidos → featured cai em avaliações ou “Em destaque”).

## Fora de escopo

Pagamentos/MP, busca, PDP, cupons, wishlist, Admin rewrite, migrations destrutivas.
