# Controlled chaos test plan (MEGA Phase 24)

**Objetivo:** validar resiliência de pagamento/webhook e readiness **sem** cobranças reais, **sem** Play publish, **sem** secrets.

## Escopo seguro

| Cenário | Como | Esperado | Cobrança |
|---------|------|----------|----------|
| Webhook duplicado (mesmo `providerEventId`) | Unit `payment.chaos.spec.ts` + `payment.webhook-idempotency.spec.ts`; opcional DB spec com Null provider | 2ª entrega `duplicate=true`, sem reaplicar crédito | Não |
| PIX expire | Unit `payment.status-machine` + chaos expire edges; DB Null provider `expired` | Payment → `expired`; order **permanece** `awaiting_payment` | Não |
| API sem OpenAI | Chat sem `OPENAI_API_KEY` | FAQ/catálogo/`llm:false` | Não |
| DB down (readiness) | Parar Postgres em staging; `GET /health/ready` | HTTP 503 `NOT_READY`; `/health` liveness ainda 200 | Não |
| Rate limit chat | >20 POST `/chat` / min | 429 | Não |
| Prompt injection | Mensagem com `system:` / ignore instructions | Sanitizado; sem vazamento de system prompt | Não |

## Fora de escopo (não executar)

- Cobrança Mercado Pago live / cartão real  
- Delete em massa / truncate produção  
- Kill -9 em produção sem janela  
- Injeção de secrets em logs  

## Checklist operacional (staging)

1. Confirmar `APP_ENV=staging` e provider Null ou sandbox sem auto-charge.  
2. Rodar unitários: `npm test` em `apps/api` (inclui `payment.chaos.spec.ts`).  
3. Hit `GET /api/v1/health` e `GET /api/v1/health/ready`.  
4. Replay webhook Null com mesmo `x-request-id` duas vezes.  
5. Registrar resultados no checkpoint (PASS/FAIL) — sem anexar tokens.

## Automação já presente

- `apps/api/src/modules/payments/payment.chaos.spec.ts`  
- `apps/api/src/modules/payments/payment.webhook-idempotency.spec.ts`  
- `apps/api/src/modules/payments/payment.status-machine.spec.ts`  
- (DB) `payment.webhook.db.spec.ts` — duplicate + expire_no_order_cancel  
