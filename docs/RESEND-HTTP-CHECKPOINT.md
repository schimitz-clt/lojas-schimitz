# Resend HTTP — e-mail no Railway (egress SMTP bloqueado)

**Status:** CONCLUÍDO (código + unit + deploy + forgot-password)
**Data:** 2026-09-08 (America/Sao_Paulo)

## Problema
Railway bloqueia outbound SMTP (`ETIMEDOUT` para Gmail e `smtp.resend.com:465`).
Nodemailer SMTP sozinho não entrega e-mail na API hospedada.

## Solução
`MailService` usa **HTTPS** `POST https://api.resend.com/emails` com Bearer quando:
- `RESEND_API_KEY` está setado, **ou**
- `SMTP_PASS` começa com `re_` e `SMTP_HOST` contém `resend` (dual-use da chave já no Railway).

Fallback: nodemailer SMTP se Resend HTTP não estiver ativo.
`MAIL_FROM` permanece o remetente (`Lojas Schimitz <onboarding@resend.dev>` no Railway).

## Validação
- Unit: mock `fetch` (RESEND_API_KEY + dual-use SMTP_PASS) em `mail.service.spec.ts`
- Live: `POST /api/v1/auth/forgot-password` → log sem ETIMEDOUT; sucesso Resend HTTP

## Env Railway
- Copiar `SMTP_PASS` (`re_…`) → `RESEND_API_KEY` (sem print), ou deixar dual-use
- Não commitar chaves

## Arquivos
- `apps/api/src/modules/mail/mail.service.ts` (+ spec)
- `docs/DEPLOY.md`, `.env.example`, `docs/API.md`
- `docs/RESEND-HTTP-CHECKPOINT.md`
