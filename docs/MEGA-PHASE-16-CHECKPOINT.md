# MEGA Phase 16 — safe performance wins

**Data:** 2026-09-12 ~20:20 America/Sao_Paulo (UTC-3)  
**Base git:** `4a8a6a7` (Phase 15 checkpoint SHA docs).  
**Commit SHA:** _(preenchido após push)_  
**Escopo:** auditoria Next img lazy/sizes, catálogo sem N+1/over-fetch, índices Prisma **aditivos** em hot paths, defaults de paginação/select. Sem migrate destrutivo, sem cobranças, sem secrets.

## FASE / STATUS

| Campo | Valor |
|-------|--------|
| **FASE** | MEGA Phase 16 — measurable safe performance |
| **STATUS** | DONE (tsc + testes relevantes; índices additive only) |
| **COMMIT** | _(SHA após push)_ |
| **PRODUÇÃO** | Migração só `CREATE INDEX IF NOT EXISTS` (não destrutiva) |
| **RISCOS** | Baixo — índices extras + menos colunas/imagens no list; sem mudança de contrato público relevante |
| **BLOQUEIOS** | Nenhum interno |

## Auditoria (antes → depois)

| Área | Antes (assumido) | Depois | Benefício mensurável |
|------|------------------|--------|----------------------|
| **Product.slug** | Já `@unique` (índice implícito) | Sem mudança | Lookup PDP já indexado |
| **Order userId / status** | Índices separados `userId`, `status`, `createdAt` | + composto `(userId, status)` | Listas filtradas user+status / admin patterns |
| **ProductImage.productId** | FK **sem** índice | `ProductImage_productId_idx` | Includes de imagens no catálogo / admin |
| **OrderItem.orderId / productId** | FK **sem** índice (só sellerId) | `OrderItem_orderId_idx` + `productId_idx` | `include: { items }` e relatórios por produto |
| **Product.active** | Filtro `active: true` em todo GET /products | `Product_active_idx` | Scan menor no catálogo público |
| **Catalog list query** | `include` imagens **todas** + category completa + campos largos (description/dims) | `select` slim + `images take: 1` | Menos rows/bytes por página (pageSize default 24, max 60) |
| **N+1 catálogo** | Um `findMany` + includes (sem loop de queries) | Mantido batch; sem N+1 introduzido | Confirma ausência de N+1 |
| **GET /orders (cliente)** | Sem `take`; `include` items+payments completos | `take: 100` + `select` slim | Cap + payload menor na conta |
| **Pagination defaults** | Catalog: page=1, pageSize=24 (cap 60) | Inalterado (já seguro) | Documentado |
| **FE product images** | ProductCard: lazy OK, **sem** `sizes`; PDP: sem loading/sizes nos thumbs | `sizes` + PDP `loading=eager` / thumbs `lazy` | Hint de layout / LCP melhor |
| **Home banners** | eager + fetchPriority | + `sizes="100vw"` | Hint de viewport |

## Feito

| Item | Onde | Nota |
|------|------|------|
| Migração aditiva | `prisma/migrations/20260912_mega16_perf_indexes` | Só `CREATE INDEX IF NOT EXISTS` |
| Schema indexes | `prisma/schema.prisma` | ProductImage.productId, OrderItem orderId/productId, Product.active, Order(userId,status) |
| Catalog list select | `catalog.controller.ts` | take:1 image; category/seller/inventory select |
| Orders list cap+select | `orders.service.ts` | take 100; campos da UI Meus pedidos |
| FE sizes/loading | `ProductCard.tsx`, `ProductClient.tsx`, `HomeBanners.tsx` | attrs nativos (sem next/image) |
| Docs | este arquivo | before/after |

## Explicitamente NÃO feito

- `DROP` / rewrite de tabelas / migrate destrutivo  
- Troca massiva para `next/image` (ainda `<img>` com attrs)  
- Full-text search / materialize views  
- Paginação cursor em admin (já `take: 100`)  
- Cobranças MP / secrets / blast de notificação  

## TESTES

- `catalog.query.spec.ts` — pagination defaults  
- `product.serialize.spec.ts` — flat image/stock  
- `tsc -p apps/api --noEmit`  
- `tsc -p apps/web --noEmit` (quando deps ok)  

## Arquivos

- `prisma/schema.prisma`  
- `prisma/migrations/20260912_mega16_perf_indexes/migration.sql`  
- `apps/api/src/modules/catalog/catalog.controller.ts`  
- `apps/api/src/modules/orders/orders.service.ts`  
- `apps/web/src/components/ProductCard.tsx`  
- `apps/web/src/components/HomeBanners.tsx`  
- `apps/web/src/app/produto/[slug]/ProductClient.tsx`  
- `docs/MEGA-PHASE-16-CHECKPOINT.md`  
