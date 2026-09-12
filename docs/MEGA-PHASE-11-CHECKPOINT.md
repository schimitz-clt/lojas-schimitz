# MEGA Phase 11 — inventory concurrency

**Data:** 2026-09-12 ~19:55 America/Sao_Paulo (UTC-3)  
**Base git:** `80be031` (Phase 10 checkpoint SHA docs).  
**Commit SHA:** `d18659c29b526dd1c4e18f8f9dbe600822c043c8`  
**Escopo:** inventário — `qtyOnHand`, `qtyReserved`, `available = max(0, onHand − reserved)`; auditoria CAS reserve/release/commit; guards anti-negativo; fix TOCTOU admin stock. Sem cobranças, sem DB destrutivo, sem secrets.

## FASE / STATUS

| Campo | Valor |
|-------|--------|
| **FASE** | MEGA Phase 11 — inventory concurrency |
| **STATUS** | DONE (unitários PASS; DB race harness SKIP neste ambiente) |
| **COMMIT** | `d18659c29b526dd1c4e18f8f9dbe600822c043c8` |
| **PRODUÇÃO** | Nenhuma mutation em produção / Railway |
| **RISCOS** | Baixo — mudanças aditivas (clamp display + CAS admin + throw no release fail) |
| **BLOQUEIOS** | Postgres local ausente → `inventory.db` / `fase-d.db` não rodaram aqui |

## Resumo

| Área | Resultado |
|------|-----------|
| Fórmula available | `availableQty` em `inventory.math.ts` — `max(0, onHand − reserved)` |
| CAS reserve | Intact: `AND (qtyOnHand - qtyReserved) >= qty` |
| CAS release | Predicado `qtyReserved >= qty`; agora **throw** se 0 rows (rollback da tx) |
| CAS commitSale | Intact + guard `qty < 1` |
| Admin set stock | TOCTOU fix: `setOnHandCas` — `UPDATE … WHERE qtyReserved <= qtyOnHand` |
| Catalog / cart / web | Clamp never-negative via `availableQty` / `Math.max(0, …)` |
| Cobranças | **Nenhuma** |
| DB local | **SKIP** — `DATABASE_URL` unset; sem Postgres em `127.0.0.1:5432` |

## Auditoria dos caminhos

| Path | Onde | Predicado / comportamento |
|------|------|---------------------------|
| Preflight create | `OrdersService.create` | `inventory.available` antes da tx |
| Reserve | `InventoryService.reserve` na tx create | CAS available ≥ qty |
| Release | `transitionFromAwaiting(…, cancelled)` | CAS reserved ≥ qty; fail → exception |
| Commit | `transitionFromAwaiting(…, paid)` | CAS reserved ≥ qty AND onHand ≥ qty |
| Restock | `PaymentsService` refund path | `qtyOnHand += qty` se status ainda no depósito |
| Admin stock | `AdminProductsService.update` | `setOnHandCas` (novo) |

Race real encontrada e corrigida (aditiva):

1. **Admin stock TOCTOU** — reserved lido fora do predicado SQL; concurrent reserve podia deixar `qtyOnHand < qtyReserved`. Agora UPDATE condicional.
2. **available display negativo** — catalog/cart/web subtraíam sem floor; alinhado a `InventoryService.available`.
3. **release silencioso** — 0 rows não abortava a tx de cancel; agora `INVENTORY_RELEASE_FAILED` força rollback (pedido permanece `awaiting_payment`).

## TESTES

### Unitários (PASS nesta sessão)

- `inventory.math.spec.ts` (fórmula + non-finite + never-negative sweep + consistency)
- `inventory.reservation.spec.ts` (oversell, pay/cancel, qty inválida, release excessivo, interleaving)
- `product.serialize.spec.ts` (available clamp)
- `concurrency.spec.ts` / `idempotency.spec.ts` / `order-status.spec.ts` / `admin-ops.spec.ts`
- `tsc --noEmit` (apps/api) — PASS

### DB / Fase D (SKIPPED — sem Postgres local)

Não rodados:

- `inventory.db.spec.ts` → imprime `SKIP (sem DATABASE_URL)`
- `fase-d.db.spec.ts` (Nest + CAS paralelo 2× última unidade)
- demais `*.db.spec.ts` de payments/cart

**Como rodar quando DB local existir** (nunca Railway/prod):

```bash
# Postgres local limpo, ex.: lojas_schimitz_fase_d em 127.0.0.1:5432
export DATABASE_URL='postgresql://USER:PASS@127.0.0.1:5432/lojas_schimitz_fase_d'
export PAYMENTS_PROVIDER=null
export ALLOW_NULL_PAYMENT_SIMULATE=true

cd /path/to/lojas-schimitz
npx prisma migrate deploy --schema=prisma/schema.prisma
npx prisma db seed --schema=prisma/schema.prisma

cd apps/api
npx tsx src/modules/inventory/inventory.db.spec.ts
# Fase D (preferir dist se o harness Nest exigir build):
npm run build && node -r tsconfig-paths/register dist/modules/orders/fase-d.db.spec.js
# ou: npx tsx src/modules/orders/fase-d.db.spec.ts
```

Critérios esperados: 1 win em 2× reserve última unidade; sem `qtyOnHand`/`qtyReserved` negativos; release na expiração; idempotency replay.

## Artefatos

- `apps/api/src/modules/inventory/inventory.math.ts` (novo)
- `apps/api/src/modules/inventory/inventory.math.spec.ts`
- `apps/api/src/modules/inventory/inventory.service.ts` (`setOnHandCas`, guards, release throw)
- `apps/api/src/modules/inventory/inventory.reservation.spec.ts`
- `apps/api/src/modules/admin/admin-products.service.ts`
- `apps/api/src/modules/catalog/product.serialize.ts` (+ spec)
- `apps/api/src/modules/cart/cart.service.ts`
- `apps/web/src/components/ProductCard.tsx`
- `apps/web/src/app/produto/[slug]/ProductClient.tsx`

## Explicitamente NÃO feito

- Cobrança Mercado Pago / PIX live  
- Provisionar Postgres neste box  
- Mutations destrutivas em DB de produção  
- Alterar predicado CAS de reserve/commit além de guards qty  

---

## Outline — Phase 12 (order state machine validation)

**Objetivo:** validar e endurecer a máquina de estados de `Order` / fulfillment sem regressão de inventário/pagamento.

| Item | Notas |
|------|--------|
| Fonte de verdade | `apps/api/src/common/order-status.ts` — `ORDER_TRANSITIONS`, `canTransition`, fulfillment helpers |
| Spec existente | `order-status.spec.ts` (unitário) |
| Admin path | `OrdersService.adminUpdateFulfillmentStatus` — UPDATE condicional anti-corrida |
| Payment path | `transitionFromAwaiting` paid\|cancelled — CAS status + inventory side-effects |
| Refund | `isRefundAllowed` / `shouldRestockOnRefund` em payments |
| Gaps a cobrir na P12 | (1) matriz completa from→to nos testes; (2) legado `separating`/`shipped`; (3) impossível paid↔cancelled após vencedor; (4) admin skip/jump inválido; (5) DB harness: 2× fulfillment advance paralelo → 1 win; (6) docs checkpoint + sem cobranças |

**Próximo passo sugerido:** suite `order-status.matrix.spec.ts` + opcional `order-status.db.spec.ts` com Postgres local; sem mudar transições de produção sem checklist de UI admin/timeline.

