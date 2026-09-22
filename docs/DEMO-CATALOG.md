# Catálogo demonstrativo — 100 SKUs

Vitrine para testar Home, busca, categorias, PDP, paginação e performance. **Não é estoque real.** Produto com `isDemo=true` não entra em sacola, pedido, reserva de estoque nem cobrança (Mercado Pago ou provider nulo).

## Identificação

- Coluna `Product.isDemo` (`Boolean`, default `false`), índices `Product_isDemo_idx` e `Product_active_isDemo_idx`.
- SKU previsível `DEMO-0001` … `DEMO-0100`.
- Nome termina com `— Série Demo` ou `— Linha Demo`. Selo `Demonstrativo`. Marca genérica `Schimitz Demo` no texto.
- Estoque gravado com `qtyOnHand = 0` (ou igual a `qtyReserved`, se já houver reserva). O bloqueio **não depende** da quantidade.

## O que conta como vendável

- `GET /products` lista ativos, **incluindo** DEMO, para a navegação. `total` é esse catálogo. A prateleira “Em breve” some quando `total >= 1`.
- `sellableTotal` = active && !isDemo (mesmos filtros da listagem).
- `demoTotal` = active && isDemo.
- `GET /admin/products/catalog-counts` → `{ total, demo, real, sellable }` com `sellable = active && !isDemo`.
- Estoque baixo do Admin e do ops **ignora** `isDemo`, para não misturar com mercadoria real.

## Migration (aditiva)

```bash
cd apps/api && npx prisma migrate deploy --schema=../../prisma/schema.prisma
```

Arquivo: `prisma/migrations/20260922_product_is_demo/migration.sql` (`ADD COLUMN` + índices). Não apaga dados.

## Seed (não faz parte do seed comercial)

```bash
cd apps/api && npm run demo-catalog:seed
```

Idempotente. Aborta se um SKU `DEMO-00xx` ou o slug já pertencer a produto `isDemo=false`. Não roda com `NODE_ENV=production` sem `DEMO_CATALOG_ALLOW_PROD=1` (não usar no Railway).

Imagens: SVG em `apps/web/public/demo-catalog/DEMO-XXXX.svg`, URL `/demo-catalog/DEMO-XXXX.svg` (mesmo domínio, sem placehold.co). Regenerar com `npm run demo-catalog:art`.

### Categorias (10 × 10)

Reusa `eletro`, `celulares`, `informatica`, `eletrodomesticos`, `casa`. Cria só se faltarem, sem renomear: `eletronicos`, `utilidades`, `ferramentas`, `beleza`, `moda`.

## CSV comercial

O import `#93` **ignora** coluna `isDemo`/`demo` e grava `isDemo: false` na criação. O seed DEMO é outro comando.

## Desativar ou remover (só DEMO)

```bash
cd apps/api && npm run demo-catalog:deactivate
cd apps/api && npm run demo-catalog:delete
```

- Desativar: `active=false` onde `isDemo=true`. Idempotente.
- Apagar: remove só `isDemo=true` sem item de pedido (e as linhas de sacola desses SKUs). Se houver pedido vinculado, apenas desativa. Nunca mexe em `isDemo=false`.

## Guards

`DEMO_NOT_PURCHASABLE` em:

- `POST /cart/items` e alteração de quantidade
- merge de sacola de visitante (a linha DEMO é ignorada)
- `POST /orders` **antes** da reserva
- `InventoryService.reserve` e `commitSale`
- `POST` de intenção de pagamento, antes de criar Payment / chamar o Mercado Pago

A vitrine desabilita Adicionar / Comprar agora e mostra o selo. A API recusa mesmo que a quantidade seja alta.
