# SCH-003 — CHECKPOINT (Pagamentos + Webhook)

**Status:** CONCLUÍDO (adapter/webhook/DB/PIX live createIntent)
**Data:** 2026-09-08 (America/Sao_Paulo)

## A) AUDITORIA

| Peça | Arquivo | Estado |
|------|---------|--------|
| PaymentProvider | payment.provider.ts | createIntent/fetch/cancel/refund/verifyWebhook |
| MercadoPagoPaymentProvider | idem | HTTP MP + HMAC |
| NullPaymentProvider | idem | dev/test |
| PaymentsService + webhook | payments.service.ts / controller | PaymentEvent + CAS paid |
| MVP methods | payments.service.ts | pix+card; boleto/wallet bloqueados |
| Risco simulateApprove | pedidos/[publicId]/page.tsx | corrigido nesta sessão |

Railway: PAYMENTS_PROVIDER=mercadopago + APP_USR live + WEBHOOK_SECRET len 64.

## B) PLANO

Harden secret/simulação; testes Postgres local; PIX live R$2; checkpoint+push.

## C) IMPLEMENTAÇÃO

- assertStrongWebhookSecret + denylist em prod/staging
- Null: fallback fraco só fora de prod; body.status só ALLOW_NULL_PAYMENT_SIMULATE=true
- null provider bloqueado em production/staging sem ALLOW_NULL_PROVIDER_IN_PROD
- Front: simular só com NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE + secret >=16
- DTO method apenas pix|card
- notification_url via PUBLIC_API_URL
- date_of_expiration offset -03:00 (Z puro = HTTP 400 no MP)
- Specs: webhook-security, webhook.db, live-pix.db


## D) VALIDAÇÃO

### Unit (local)
- payment.translate / null / status-machine / webhook-security / integration → **PASS**

### Webhook DB `lojas_schimitz_sch003` (Nest real, tsc+node)
- boleto bloqueado PASS
- signature fail 401 PASS
- approve → order paid PASS
- duplicate PaymentEvent PASS
- out-of-order sem regressão PASS
- expire/cancel payment sem cancelar order PASS
- body≠truth PASS

### MP LIVE controlado
- PIX R$2 API: id 176894474139 pending_waiting_transfer + QR; cancelled cleanup → PASS
- createIntent Nest+DB: order SCH-LP-11E3CF, payment f78a0c88-d6bf-4622-86a8-c0e926b85c4f, mpExternalId 176892467145 → PASS
- verifyWebhook HMAC (secret Railway, sem print) → PASS
- fetchPayment live pending amount 2 → PASS
- webhook body approved + MP pending → order awaiting_payment → PASS
- Liquidação PIX até approved/paid live → **NÃO EXECUTADO** (exige pagar QR)
- Refund admin live → **NÃO EXECUTADO**

DB testes: só 127.0.0.1 / lojas_schimitz_sch003 — nunca Railway DATABASE_URL.

## E) ARQUIVOS

- apps/api/src/modules/payments/payment.provider.ts
- apps/api/src/modules/payments/dto.ts
- apps/api/src/modules/payments/payment.null.spec.ts
- apps/api/src/modules/payments/payment.webhook-security.spec.ts (novo)
- apps/api/src/modules/payments/payment.webhook.db.spec.ts (novo)
- apps/api/src/modules/payments/payment.live-pix.db.spec.ts (novo)
- apps/web/src/app/pedidos/[publicId]/page.tsx
- apps/api/package.json
- .env.example
- docs/SCH-003-CHECKPOINT.md

## F) PENDÊNCIAS

1. Pagar PIX live se quiser prova paid no painel MP + webhook Railway
2. OpenAPI/Swagger — NÃO EXECUTADO
3. Password reset / guest cart merge / PIX 5% backend
4. Opcional: credenciais TEST- sandbox

Env Railway (nomes): PAYMENTS_PROVIDER, MERCADO_PAGO_ACCESS_TOKEN, MERCADO_PAGO_WEBHOOK_SECRET, MERCADO_PAGO_PUBLIC_KEY, NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY, PUBLIC_API_URL

Env só dev: ALLOW_NULL_PAYMENT_SIMULATE, NULL_WEBHOOK_SECRET, NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE, NEXT_PUBLIC_NULL_WEBHOOK_SECRET, ALLOW_NULL_PROVIDER_IN_PROD

## G) STATUS

**SCH-003: CONCLUÍDO** — adapter real, HMAC, PaymentEvent, CAS paid em Postgres, PIX live createIntent R$2, body≠truth.

Liquidação bancária do PIX até approved: NÃO EXECUTADO.

### Próximo passo
Password reset → guest cart merge → PIX 5% backend → OpenAPI.
