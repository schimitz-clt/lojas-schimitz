# MEGA Phase 12 — order state machine validation

**Data:** 2026-09-12 ~20:05 America/Sao_Paulo (UTC-3)  
**Base git:** `a178132` (Phase 11 checkpoint SHA docs).  
**Commit SHA:** _(preenchido após commit)_  
**Escopo:** validação centralizada de transições de `OrderStatus` + preservação de histórico (`OrderStatusHistory`). Sem cobranças, sem DB destrutivo, sem secrets.

## FASE / STATUS

| Campo | Valor |
|-------|--------|
| **FASE** | MEGA Phase 12 — order state machine validation |
| **STATUS** | DONE (unitários PASS; DB harness SKIP neste ambiente) |
| **COMMIT** | _(ver git após push)_ |
| **PRODUÇÃO** | Nenhuma mutation em produção / Railway |
| **RISCOS** | Baixo — allowlist já existia; alinhamento `in_transit`/`shipped` → `refunded` + erros mais claros |
| **BLOQUEIOS** | Postgres local ausente → harness DB paralelo de fulfillment não rodou aqui |

## Resumo

| Área | Resultado |
|------|-----------|
| Fonte de verdade | `apps/api/src/common/order-status.ts` — `ORDER_TRANSITIONS`, `canTransition`, `assertValidTransition` |
| Happy path | `draft→awaiting_payment→paid→organizing→packing→ready_for_pickup→in_transit→delivered` |
| Exceções | `cancelled` (draft/awaiting_payment); `refunded` via allowlist; legado `separating`/`shipped` |
| Admin path | `OrdersService.adminUpdateFulfillmentStatus` → `assertValidTransition` → `BadRequestException(payload)` |
| Payment CAS | `transitionFromAwaiting` — CAS `awaiting_payment` + check `canTransition` |
| Refund | `isRefundAllowed` = `canTransition(status, 'refunded')` (SoT única) |
| Histórico | Modelo existente `OrderStatusHistory` — create / pay-cancel / admin / refund já gravam |
| Cobranças | **Nenhuma** |
| DB local | **SKIP** — sem `DATABASE_URL` / Postgres neste box |

## Auditoria (pré-mudança)

| Path | Onde | Validação | Histórico |
|------|------|-----------|-----------|
| Create | `OrdersService.create` | cria já em `awaiting_payment` (histórico `draft→awaiting_payment`) | `recordStatusHistory` |
| Pay / cancel CAS | `transitionFromAwaiting` | UPDATE condicional `status=awaiting_payment` | sim (`payment_confirmed` / `cancelled_or_expired`) |
| Admin PATCH | `AdminUpdateOrderStatusDto` + `adminUpdateFulfillmentStatus` | DTO `IsIn` + `canTransition` | sim (`admin_fulfillment`) |
| Refund | `PaymentsService.adminRefund` / `finalizeRefundLocal` | `isRefundAllowed` + CAS payment/order | `OrderStatusHistory` `payment_refunded` |

Gap encontrado e corrigido (aditivo):

1. **Allowlist vs refund** — `isRefundAllowed` incluía `in_transit`/`shipped`, mas `ORDER_TRANSITIONS` não listava `→ refunded`. Agora alinhados; `isRefundAllowed` delega a `canTransition`.
2. **Erro admin** — passa a incluir `from`, `to`, `allowed` via `InvalidOrderTransitionError.payload`.
3. **DTO** — `ADMIN_FULFILLMENT_TARGETS` compartilhado com a allowlist de alvos admin (sem divergência IsIn).

## Máquina de estados (allowlist)

```
draft ──────────────► awaiting_payment ──► paid ──► organizing ──► packing
         │                    │              │           │            │
         └─ cancelled         └─ cancelled   └─ refunded └─ refunded  └─ refunded
                                                              │
ready_for_pickup ──► in_transit ──► delivered (terminal)
        │                 │
        └─ refunded       └─ refunded

legado: separating → packing | in_transit | shipped | refunded
        shipped → delivered | refunded
```

## TESTES

### Unitários (PASS nesta sessão)

- `order-status.spec.ts` (transitions + assertValidTransition + refund align)
- `order-status.matrix.spec.ts` (happy path, saltos inválidos, legado, matriz exaustiva, CAS paid×cancelled, admin one-step)
- `order-timeline.spec.ts` / `concurrency.spec.ts` (regressão)
- `tsc --noEmit` (apps/api) — a confirmar no commit

### DB (SKIPPED — sem Postgres local)

Não rodados: harness paralelo 2× fulfillment advance. Quando DB local existir, preferir espelhar padrão Fase D (`fase-d.db.spec.ts`) sem apontar Railway/prod.

## Artefatos

- `apps/api/src/common/order-status.ts` (`assertValidTransition`, `ORDER_STATUS_HAPPY_PATH`, `ADMIN_FULFILLMENT_TARGETS`, refund SoT)
- `apps/api/src/common/order-status.matrix.spec.ts` (novo)
- `apps/api/src/common/order-status.spec.ts`
- `apps/api/src/modules/orders/orders.service.ts`
- `apps/api/src/modules/orders/dto.ts`
- `apps/api/package.json` (script `test` inclui matrix)
- `docs/MEGA-PHASE-12-CHECKPOINT.md`

## Explicitamente NÃO feito

- Cobrança Mercado Pago / PIX live  
- Migração destrutiva / nova tabela (reusou `OrderStatusHistory`)  
- Mutations em DB de produção  
- Alterar side-effects de inventário no refund além do alinhamento allowlist  

---

## Outline — Phase 13 (sugerido)

| Item | Notas |
|------|--------|
| DB race fulfillment | 2× `adminUpdateFulfillmentStatus` paralelo → 1 win (CAS `updateMany`) |
| UI admin | Garantir one-click usa só `nextFulfillmentStatus` |
| Observabilidade | Dashboard de pedidos stuck em legado `separating`/`shipped` |
