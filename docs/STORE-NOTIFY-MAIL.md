# Avisos de venda paga — Resend / STORE_NOTIFY / MAIL_FROM

Data: 2026-09-16 (America/Sao_Paulo)

## Fluxo (código)

1. Pagamento aprovado → `PaymentsService.notifyCustomerPaid` **ou** `OrdersService.markPaid`
2. Cliente: in-app `order_paid` + e-mail `mail.notifyOrderPaid` (se tiver e-mail)
3. Loja: `NotificationsService.notifyStoreOfPaidOrder`
   - in-app para **todos** os admins ativos
   - e-mail para `resolvePaidSaleEmailRecipients()` = admins ativos no DB ∪ `STORE_NOTIFY_EMAIL` ∪ `ADMIN_EMAIL`
4. Reenvio manual (ops): `POST /admin/orders/:id/notify-paid` (pedido já pós-pago)

## Variáveis

| Env | Papel |
|---|---|
| `MAIL_FROM` | Remetente (ex. `Lojas Schimitz <noreply@…>`). **Não** é destinatário da loja. |
| `RESEND_API_KEY` | Preferido no Railway (HTTPS). Alternativa: SMTP dual-use Resend. |
| `SMTP_HOST` / `SMTP_PASS` | Alternativa SMTP; se host Resend + pass `re_…`, API usa HTTPS. |
| `STORE_NOTIFY_EMAIL` | Destinatário(s) da loja (CSV). **Fonte de verdade** do dono. |
| `ADMIN_EMAIL` | Fallback / promoção a admin ativo no boot. |

Sem `MAIL_FROM` + (`RESEND_API_KEY` **ou** `SMTP_HOST`): mail provider **off** — API **não quebra** pagamento; só log + in-app.

## O que NÃO fazer

- Não colocar `noreply@` em `STORE_NOTIFY_EMAIL`
- Não esperar que `MAIL_FROM` receba o aviso de venda (código ignora noreply e não usa MAIL_FROM como inbox)
- Não usar `PAYMENTS_PROVIDER=null` / NullProvider em produção

## Validação produção

1. Railway API: `RESEND_API_KEY` + `MAIL_FROM` + `STORE_NOTIFY_EMAIL` setados
2. `GET /admin/ops` → `mail.configured: true`, `mail.recipientCount` ≥ 1, `mail.failureCount: 0`
3. Pedido pago de teste → e-mail cliente + e-mail loja + in-app admin
4. Se falhar: logs `STORE_EMAIL_SEND_FAILED` / `MAIL_PROVIDER_OFF*` **e** alerta no Centro de comando (`store_email_send_failed` / `mail_off_with_store_notify` / `store_email_no_recipients`) — não só Railway
5. Admin: botão **Reenviar aviso loja** no card do pedido. A copy distingue *falhou ao enviar* vs *não foi tentado* (provider off / sem destinatário). `emailsAttempted: 0` não é sucesso.

`mail.recentFailures` é **process-local** (some no restart da API). Contagem `recipientCount` é real (DB∪env, sem endereços). Nenhuma env nova.
