# SCH-005 — OpenAPI/Swagger + Admin CRM clientes + IDOR pagamentos

**Status:** CONCLUÍDO
**Data:** 2026-09-08 (America/Sao_Paulo)

## A) AUDITORIA

| Peça | Estado pré |
|------|------------|
| OpenAPI/Swagger UI | AUSENTE → `common/swagger.ts` + gate env |
| Admin CRM clientes | AUSENTE → `AdminCustomersService` + GET list/detail |
| Front admin clientes | AUSENTE → seção CRM read-only em `/admin` |
| Pagamentos IDOR | 403 Forbidden cross-user → 404 NotFound (sem enumeração) |
| Addresses throttle | Parcial → Throttle em POST/PATCH/DELETE |
| Docs API/SECURITY | Sem SCH-005 → atualizados |

## B) PLANO

Swagger com default OFF em prod/staging → CRM admin read-only → endurecer IDOR payments → unit + Postgres local → checkpoint + push.

## C) IMPLEMENTAÇÃO

### OpenAPI / Swagger
- `apps/api/src/common/swagger.ts`: `shouldEnableSwagger` / `setupSwagger`
- Default ON fora de production/staging; OFF em prod/staging; `SWAGGER_ENABLED=true|false` sobrescreve
- UI em `/api/v1/docs`; tags health/auth/orders/payments/addresses/admin/webhooks
- Bearer + `x-guest-token` + `Idempotency-Key`; sanitidade anti-leak de nomes de env secrets no documento
- Helmet: CSP desligado só quando Swagger ativo (UI inline)
- Decorators `@ApiTags` / `@ApiOperation` / `@ApiProperty` nos controllers/DTOs principais

### Admin CRM clientes (read-only)
- `GET /admin/customers?q=&take=&skip=` → `{ items, total, take, skip }`
- `GET /admin/customers/:id` → detalhe + até 50 pedidos; **sem** `passwordHash`
- Filtro `role=customer` only (admin → 404)
- Busca insensitive em email/name/phone; `clampTake` max 100
- Contagens: `ordersCount`, `paidOrdersCount`, `paidTotal` (statuses `PAID_REVENUE_STATUSES`)
- Front: card “Clientes (CRM)” com busca e detalhe modal/painel

### IDOR pagamentos
- `createIntent` pedido de outro user → `ORDER_NOT_FOUND` 404 (antes 403)
- `getPayment` pagamento de outro user → `PAYMENT_NOT_FOUND` 404 (antes 403)
- `getByOrder` já filtrava `{ id, userId }` → 404

### Endereços
- Throttle em create/update/remove; docs Swagger de ownership scoped

## D) VALIDAÇÃO (somente inventado=não; resultados reais)

DB: `postgresql://schimitz:***@127.0.0.1:5432/lojas_schimitz_sch005` — **nunca Railway**.

| Spec | Resultado |
|------|-----------|
| `swagger.spec.ts` | PASS |
| `admin-customers.spec.ts` | PASS |
| `payment.idor.spec.ts` | PASS |
| `payment.null.spec.ts` | PASS |
| `payment.webhook-security.spec.ts` | PASS |
| `admin-customers.db.spec.ts` | PASS |
| `tsc --noEmit` (apps/api) | PASS |

## E) ARQUIVOS

- apps/api/src/common/swagger.ts (+ swagger.spec.ts)
- apps/api/src/main.ts
- apps/api/src/modules/admin/admin-customers.service.ts (+ unit + db specs)
- apps/api/src/modules/admin/admin.controller.ts / admin.module.ts / dto.ts
- apps/api/src/modules/payments/payments.service.ts (+ payment.idor.spec.ts)
- Controllers/DTOs: auth, orders, payments, addresses, health (+ Api decorators)
- apps/web/src/app/admin/page.tsx (CRM)
- apps/api/package.json + package-lock.json (@nestjs/swagger, swagger-ui-express)
- .env.example, docs/API.md, docs/SECURITY.md, docs/SCH-005-CHECKPOINT.md

## F) PENDÊNCIAS

1. Cookie HttpOnly refresh — NÃO EXECUTADO
2. Job periódico expireReservations — NÃO EXECUTADO
3. Liquidação PIX live até paid — NÃO EXECUTADO (SCH-003)
4. Cobertura OpenAPI completa em todos os módulos (catalog/cart/etc.) — parcial (rotas principais)

## G) STATUS

| Item | Status |
|------|--------|
| OpenAPI/Swagger | CONCLUÍDO |
| Admin CRM clientes | CONCLUÍDO |
| IDOR payments 404 | CONCLUÍDO |
| Docs + testes locais | CONCLUÍDO |

SHA: `601ee9a`
