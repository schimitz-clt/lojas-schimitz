# SCH-006 — Sessão HttpOnly + OpenAPI expand + expireReservations multi-réplica + frete POA 91

**Status:** CONCLUÍDO (escopo desta fatia)
**Data:** 2026-09-08 (America/Sao_Paulo)
**Base:** `2339635` (SCH-005)

## A) AUDITORIA

| Peça | Estado pré |
|------|------------|
| Refresh só no JSON + localStorage | XSS pode roubar refresh longo |
| OpenAPI | auth/orders/payments/addresses/admin — sem catalog/cart/shipping |
| expireReservations | `setInterval` por processo; corrida de pedido OK; cancelIntent podia duplicar |
| Frete POA | regra típica só `90`; CEP usuário `91160-390` (prefixo `91`) cobrado |

## B) PLANO

Cookie HttpOnly dual-mode (sem quebrar mobile/TWA) → tags OpenAPI → lease `SchedulerLock` → defaults CEP 90/91 → testes reais → push.

## C) IMPLEMENTAÇÃO

### Sessão / refresh cookie (dual-mode — honesto)
- `apps/api/src/modules/auth/refresh-cookie.ts`: set/clear/read; env `REFRESH_COOKIE_*`
- Login/register/refresh: `Set-Cookie` HttpOnly + JSON ainda com `refreshToken`
- Refresh: body **ou** cookie (body vence); `RefreshDto.refreshToken` opcional
- Logout: limpa cookie + revoga
- Web: `credentials: 'include'`; access em localStorage; refresh localStorage = fallback cross-origin
- **Limite:** cross-site localhost sem HTTPS pode não enviar cookie; produção → `REFRESH_COOKIE_DOMAIN` ou proxy same-site

### OpenAPI
- Tags/operations: catalog, cart, shipping (+ DTOs cart/shipping)
- Swagger version 0.6.0

### expireReservations multi-réplica
- `scheduler-lock.ts`: tabela `SchedulerLock` (CREATE IF NOT EXISTS) + lease TTL
- Job: adquire lease → `expireReservations` → libera
- Contratos SCH-002.1 preservados (job não libera estoque direto)

### Frete POA 91
- `ensureDefaultPoaRules()` cria `90` e `91` fee=0 se ausentes (não sobrescreve admin)
- Seed espelha; testes `91160-390` / `91250000`

## D) VALIDAÇÃO (inventado=não)

| Spec | Resultado |
|------|-----------|
| `refresh-cookie.spec.ts` | PASS |
| `reservations-expiry.spec.ts` | PASS |
| `scheduler-lock.spec.ts` | PASS |
| `scheduler-lock.db.spec.ts` (Postgres `lojas_schimitz_sch005`) | PASS |
| `shipping.quote.spec.ts` (incl. CEP 91) | PASS |
| `swagger.spec.ts` | PASS |
| `tsc --noEmit` (apps/api) | PASS |

## E) ARQUIVOS

- apps/api/src/modules/auth/refresh-cookie.ts (+ spec)
- apps/api/src/modules/auth/auth.controller.ts / dto.ts / auth.service.ts
- apps/api/src/modules/orders/scheduler-lock.ts (+ specs) / reservations-expiry.service.ts
- apps/api/src/modules/catalog/catalog.controller.ts
- apps/api/src/modules/cart/cart.controller.ts / dto.ts
- apps/api/src/modules/shipping/shipping.controller.ts / shipping.service.ts / shipping.quote.spec.ts
- apps/api/src/common/swagger.ts
- apps/web/src/lib/api.ts
- prisma/seed.ts
- docs/SECURITY.md, API.md, DEPLOY.md, SCH-006-CHECKPOINT.md
- .env.example, apps/api/package.json

## F) PENDÊNCIAS / OWNER

1. Cookie first-party em produção (`REFRESH_COOKIE_DOMAIN` / proxy) — OWNER ops
2. SMTP real + prova de e-mail — OWNER (checklist em DEPLOY.md)
3. Remover refresh do localStorage web só após cookie same-site confirmado
4. Fotos produto / Play / OpenAI billing — OWNER
5. Liquidação PIX live / refund — só sob pedido explícito com evidência

## G) STATUS

| Item | Status |
|------|--------|
| Refresh cookie dual-mode + testes | CONCLUÍDO |
| OpenAPI catalog/cart/shipping | CONCLUÍDO |
| SchedulerLock multi-réplica | CONCLUÍDO |
| Frete CEP 91 grátis (código + seed) | CONCLUÍDO |
| Docs SECURITY/API/DEPLOY | CONCLUÍDO |

SHA: _(preenchido após push)_
