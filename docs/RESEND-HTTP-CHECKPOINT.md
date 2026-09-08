# Resend HTTP — e-mail no Railway (egress SMTP bloqueado)

**Status:** CONCLUÍDO
**Data:** 2026-09-08 (America/Sao_Paulo)
**SHA:** `3900869`

## Problema
Railway bloqueia outbound SMTP (`ETIMEDOUT` para Gmail e `smtp.resend.com:465`).
Nodemailer SMTP sozinho não entrega e-mail na API hospedada.

## Solução
`MailService` usa **HTTPS** `POST https://api.resend.com/emails` com Bearer quando:
- `RESEND_API_KEY` está setado, **ou**
- `SMTP_PASS` começa com `re_` e `SMTP_HOST` contém `resend` (dual-use).

Fallback: nodemailer SMTP se Resend HTTP não estiver ativo.
`MAIL_FROM` = remetente (`Lojas Schimitz <onboarding@resend.dev>` no Railway).

## Validação
| Item | Resultado |
|------|-----------|
| Unit mock `fetch` (RESEND_API_KEY + dual-use) | PASS |
| `tsc --noEmit` apps/api | PASS |
| Deploy Railway `036e4b1b…` | SUCCESS |
| Boot log | `Resend HTTP API configurado (api.resend.com)` |
| Live `POST /auth/forgot-password` | HTTP 201; **sem ETIMEDOUT** |
| Mail log | `E-mail enviado via Resend HTTP: Redefinição de senha — Lojas Schimitz → schimitzclaiton@gmail.com [id=c2c693a4-8143-4daa-b94a-2ae7d2e6609d]` (UTC 05:40:11 ≈ 02:40 PT) |

## Env Railway
- `RESEND_API_KEY` copiado de `SMTP_PASS` (`re_…`, sem print); dual-use também funciona
- Segredos não commitados

## Arquivos
- `apps/api/src/modules/mail/mail.service.ts` (+ spec)
- `docs/DEPLOY.md`, `.env.example`, `docs/API.md`
- `docs/RESEND-HTTP-CHECKPOINT.md`
