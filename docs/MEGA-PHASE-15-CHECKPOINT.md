# MEGA Phase 15 — notification events (lifecycle, idempotent)

**Data:** 2026-09-12 ~20:15 America/Sao_Paulo (UTC-3)  
**Base git:** `80569e2` (Phase 14 checkpoint SHA docs).  
**Commit SHA:** 
**Escopo:** auditoria + fills de mail/in-app no ciclo de pedido; idempotência sem spam; sem PII/secrets nos logs além de order id / publicId; templates Resend text. Sem blast, sem cobranças, sem secrets no git.

## FASE / STATUS

| Campo | Valor |
|-------|--------|
| **FASE** | MEGA Phase 15 — reliable notification events |
| **STATUS** | DONE (unitários PASS; tsc API PASS) |
| **COMMIT** | 
| **PRODUÇÃO** | Nenhuma mutation em produção; nenhum envio real em massa |
| **RISCOS** | Baixo — best-effort notify + process-local mail TTL + in-app dedupe |
| **BLOQUEIOS** | **BLOQUEIO EXTERNO** — domínio Resend verificado (OWNER); ver Phase 6 |

## Auditoria (mail + in-app)

| Evento | Mail | In-app | Idempotência |
|--------|------|--------|--------------|
| **Register / welcome** | `welcomeRegisterEmail` | `type=welcome` | mail `welcome:to`; in-app user+type |
| **Password reset** | `passwordResetEmail` | — | **sem** chave (reenvio legítimo); log local sem recipient e-mail |
| **Order created** | `orderCreatedEmail` | `type=order_created` | mail `order_created:publicId:to`; in-app user+order+type |
| **Payment approved** | `orderPaidEmail` + admin fan-out | `order_paid` (cliente + admins) | CAS paid + mail TTL + createSafe (Phase 6) |
| **Payment refused** | `paymentRefusedEmail` | `type=payment_refused` | pending→refused once + mail TTL + createSafe |
| **Organizing / packing** | `orderStatusEmail` (label) | `order_status` + title | mail key inclui label; in-app title |
| **Ready / shipped / delivered** | ready / shipped / delivered templates | `order_status` | mail kind+publicId; in-app title |
| **Cancelled** | — | `order_cancelled` | createSafe user+order+type |

## Feito

| Item | Onde | Nota |
|------|------|------|
| Templates novos | `mail.templates.ts` | welcome, order_created, payment_refused |
| Mail kinds + keys | `mail.config.ts` | `welcome` / `order_created` / `payment_refused` |
| MailService | `mail.service.ts` | `notifyWelcome` / `notifyOrderCreated` / `notifyPaymentRefused`; reset log sem e-mail |
| In-app dedupe | `notification-dedupe.ts` + `createSafe` | order_paid/cancelled/created, payment_refused, order_status(+title), welcome |
| Wire register | `auth.service.ts` | welcome mail + in-app |
| Wire order create | `orders.service.ts` | após `order.created` |
| Wire payment refused | `payments.service.ts` | intent refuse + webhook `refused` |
| Logs | mail/notifications/orders/payments | sem destinatário e-mail; `order=` publicId |
| Tests | mail.config/service + notification-dedupe + admin-notify wiring | |
| Docs | este arquivo | |

## Explicitamente NÃO feito

- Campanha / blast de clientes  
- Cobrança Mercado Pago / Play  
- Secrets no git / rotação de keys  
- WhatsApp Cloud auto-send  
- Dedup persistente cross-process (continua process-local TTL 15 min + DB in-app)

## TESTES

- `notification-dedupe.spec.ts` — where keys + skip simulado  
- `mail.config.spec.ts` — Phase 15 kinds  
- `mail.service.spec.ts` — Phase 15 idempotent kinds (welcome/created/refused/status/shipped/delivered)  
- `admin-notify.spec.ts` — wiring audit  
- `tsc -p apps/api --noEmit` — PASS  

## Arquivos

- `apps/api/src/modules/mail/mail.config.ts` (+ spec)  
- `apps/api/src/modules/mail/mail.templates.ts`  
- `apps/api/src/modules/mail/mail.service.ts` (+ spec)  
- `apps/api/src/modules/notifications/notification-dedupe.ts` (+ spec)  
- `apps/api/src/modules/notifications/notifications.service.ts`  
- `apps/api/src/modules/notifications/admin-notify.spec.ts`  
- `apps/api/src/modules/auth/auth.service.ts`  
- `apps/api/src/modules/orders/orders.service.ts`  
- `apps/api/src/modules/payments/payments.service.ts`  
- `apps/api/package.json`  
- `docs/MEGA-PHASE-15-CHECKPOINT.md`  
