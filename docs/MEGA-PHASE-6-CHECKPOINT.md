# MEGA Phase 6 (safe / additive) — mail / notifications hardening

**Data:** 2026-09-12 ~19:25 America/Sao_Paulo (UTC-3)  
**Escopo:** auditoria de envios duplicados, idempotência process-local, logging sem secrets, sinal `mailConfigured`, docs de bloqueio Resend. Sem rotação de secrets, sem blast real a clientes, sem cobrança MP, sem migration destrutiva, sem Play publish.

## Feito

| Item | Onde | Nota |
|------|------|------|
| Modo provedor tipado | `mail.config.ts` + `MailService` | `resend-http` \| `smtp` \| `off` |
| Idempotência process-local | `MailService.claimIdempotency` | TTL 15 min; chave `kind:publicId:to`; falha libera claim; password reset **sem** chave |
| Dedup in-app `order_paid` | `NotificationsService.createSafe` | Skip se já existe `(userId, orderId, type=order_paid)` |
| CAS pago (já existia) | `transitionFromAwaiting` | Só o vencedor notifica; path payments não re-notifica em `already_paid` |
| Logging sem secrets | `mail.service.ts` | `mail ok/fail/skip mode=… kind=… id=…` — sem Bearer, sem `re_…`, sem lista de destinatários no send |
| Health | `GET /health` → `mailConfigured` | Presença de nomes `MAIL_FROM` + (`RESEND_API_KEY` \| `SMTP_HOST`) — **não** lê valores de segredo |
| Admin ops | `GET /admin/ops` → `mail.configured` | Mesmo sinal de presença |
| Unit | `mail.config.spec.ts`, `mail.service.spec.ts`, `admin-ops.spec.ts` | modo, presença, idempotência, retry após fail |

## Auditoria de duplicatas

| Caminho | Risco | Guard |
|---------|-------|-------|
| Webhook/approve → `notifyCustomerPaid` | Retry MP | CAS `awaiting_payment→paid`; se já `paid` → sem re-notify |
| `orders.markPaid` vs payments | Corrida | Mesmo CAS; só um vence |
| Fan-out admin e-mail | DB + env | `resolvePaidSaleEmailRecipients` dedup; MailService idempotency por `admin_order_paid:publicId:to` |
| In-app "Novo pagamento" / "Pedido pago" | Duplo path | `createSafe` skip duplicate `order_paid` |
| Fulfillment e-mail | Double-click admin | UPDATE condicional `status=from`; + idempotency mail |
| Forgot-password | Reenvio legítimo | Sem idempotência (intencional) |

## BLOQUEIO EXTERNO — Resend (OWNER)

A API **não** valida DNS nem domínio. O dono deve conferir no **dashboard Resend** (sem colar API keys em issues/docs/commits):

1. **Domínio** de produção (ex.: `lojasschimitz.com.br`) adicionado em Resend → Domains.
2. **DNS** publicados e **Verified** (SPF / DKIM / e registros que o painel listar). Propagação pode levar horas.
3. **`MAIL_FROM`** no Railway API usando endereço **do domínio verificado** (não só `onboarding@resend.dev` em produção real para clientes).
4. **`RESEND_API_KEY`** (ou dual-use `SMTP_HOST=smtp.resend.com` + `SMTP_PASS=re_…`) presente no serviço API — valor só no painel Railway; nunca no git.
5. Após DNS OK: redeploy API se as variáveis mudaram; smoke **controlado** com e-mail do dono (`POST /auth/forgot-password`), **não** blast de clientes.
6. Conferir log: `mail provider mode=resend-http` no boot e `mail ok mode=resend-http … id=…` no envio (sem `ETIMEDOUT`).

Enquanto o domínio não estiver **Verified** no Resend, entregas a destinatários arbitrários podem falhar ou ficar restritas ao sandbox — isso é **bloqueio externo**, não bug da Phase 6.

## Fora deste slice

- Rotacionar / reescrever secrets
- Envio em massa / campanha
- Cobrança Mercado Pago / Play production
- Trocar fotos placehold.co

## Arquivos

- `apps/api/src/modules/mail/mail.config.ts` (+ spec)
- `apps/api/src/modules/mail/mail.service.ts` (+ spec)
- `apps/api/src/modules/notifications/notifications.service.ts`
- `apps/api/src/modules/health/health.controller.ts`
- `apps/api/src/modules/admin/admin-ops.ts` (+ spec) / `admin.controller.ts`
- `docs/MEGA-PHASE-6-CHECKPOINT.md`
