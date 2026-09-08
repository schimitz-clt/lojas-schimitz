# SCH-004 — Password reset + Guest cart merge + PIX 5% backend

**Status:** CONCLUÍDO
**Data:** 2026-09-08 (America/Sao_Paulo)

## A) AUDITORIA

| Peça | Estado pré |
|------|------------|
| Auth login/register/refresh/logout | OK |
| Password reset | AUSENTE → implementado |
| PasswordResetToken | AUSENTE → migration `20260908_password_reset` |
| MailService | OK orders; + `notifyPasswordReset` |
| Cart guest/user | Separados; merge AUSENTE → `mergeGuestIntoUser` |
| Front esqueci/redefinir | AUSENTE → `/esqueci-senha` `/redefinir-senha` |
| PIX 5% | Só front `pricing.ts` → autoridade API `common/pricing.ts` |

## B) PLANO

Password reset real → guest merge no login/register → PIX 5% no createIntent → testes Postgres local → push.

## C) IMPLEMENTAÇÃO

### Password reset
- `POST /auth/forgot-password` `{ email }` — resposta genérica; token 32 bytes hex; DB guarda SHA-256; TTL 1h; invalida tokens anteriores
- `POST /auth/reset-password` `{ token, password }` — uso único; revoga **todos** refresh tokens
- Rate limit: Throttler + contador in-memory (IP/e-mail, 15 min)
- SMTP: envia e-mail; sem SMTP persiste token e loga link no Logger da API (local) — **nunca na resposta HTTP**
- Front: `/esqueci-senha`, `/redefinir-senha?token=`

### Guest cart merge
- `AuthController` login/register lê `x-guest-token` e chama `CartService.mergeGuestIntoUser`
- Revalida ativo + estoque; soma qty; capa ao disponível; remove produto inativo; apaga carrinho guest
- Front limpa `sch_guest` após login/cadastro

### PIX 5% backend
- `apps/api/src/common/pricing.ts` autoridade
- `createIntent` method=pix → `Payment.amount = 95%` de `Order.total`; card = total cheio
- No approve PIX: `Order.discount += delta`, `Order.total = payment.amount` (cashback sobre valor pago)
- Doc: `docs/PIX-DISCOUNT.md` (front display-only vs SCH-002/003)

## D) VALIDAÇÃO (somente inventado=não; resultados reais)

DB: `postgresql://schimitz:***@127.0.0.1:5432/lojas_schimitz_auth` — **nunca Railway**.

| Spec | Resultado |
|------|-----------|
| `pricing.spec.ts` | PASS |
| `mail.service.spec.ts` (reset template) | PASS |
| `password-reset.db.spec.ts` | PASS |
| `cart-merge.db.spec.ts` | PASS |
| `pix-discount.db.spec.ts` | PASS |
| `tsc --noEmit` | PASS |

## E) ARQUIVOS

- prisma/schema.prisma + migrations/20260908_password_reset/
- apps/api/src/modules/auth/* (service/controller/dto/module + password-reset.db.spec)
- apps/api/src/modules/cart/cart.service.ts (+ cart-merge.db.spec)
- apps/api/src/modules/mail/*
- apps/api/src/common/pricing.ts (+ spec)
- apps/api/src/modules/payments/payments.service.ts (+ pix-discount.db.spec)
- apps/web: esqueci-senha, redefinir-senha, entrar, cadastro, api.ts, pedidos, pricing.ts
- docs: SCH-004-CHECKPOINT, PIX-DISCOUNT, API, SECURITY, .env.example

## F) PENDÊNCIAS

1. OpenAPI/Swagger — NÃO EXECUTADO
2. Cookie HttpOnly refresh — NÃO EXECUTADO
3. Job periódico expireReservations — NÃO EXECUTADO
4. Liquidação PIX live até paid — NÃO EXECUTADO (SCH-003)

## G) STATUS

| Item | Status |
|------|--------|
| Password reset | CONCLUÍDO |
| Guest cart merge | CONCLUÍDO |
| PIX 5% backend | CONCLUÍDO |

SHA: (preencher no commit)
