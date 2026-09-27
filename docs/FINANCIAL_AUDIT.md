# Auditoria financeira — Lojas Schimitz (COMANDO OMEGA, Fase 1)

**Base auditada:** `main` @ `7793cf8` (26/09/2026). Todas as referências `arquivo:linha` apontam para esse commit
(código **antes** das mudanças deste PR). Fonte única: o código do repositório. Nada foi inferido de produção
(sem acesso ao banco de produção, sem logs de produção, sem chamadas reais ao Mercado Pago).

Legenda de STATUS: **EXISTE E FUNCIONA** · **EXISTE MAS INCOMPLETO** · **EXISTE MAS TEM RISCO** · **NÃO EXISTE**.
Coluna "Depois do PR" resume o que mudou (detalhes em `FINANCIAL_ARCHITECTURE.md`).

## Tabela-resumo

| # | Área | STATUS (main) | Motivo em uma linha | Depois do PR |
|---|------|---------------|---------------------|--------------|
| A | Arquitetura | EXISTE E FUNCIONA | NestJS + Prisma/Postgres, provider plugável (`mercadopago`/`null`), módulos separados | + módulos `finance-core` (global) e `finance` |
| B | Checkout | EXISTE E FUNCIONA | Idempotency-Key obrigatória, preço do banco, reserva CAS na mesma transação | reserva agora também registrada no diário de estoque |
| C | PIX | EXISTE E FUNCIONA | Intenção idempotente, 1 pendente por pedido (índice parcial), valor calculado no backend | + estado financeiro/ledger |
| D | Cartão (Brick) | EXISTE E FUNCIONA | Só token do Brick chega ao backend; aprovado na criação passa pelo mesmo apply | + PAYMENT_FAILED no ledger ao recusar |
| E | Integração Mercado Pago | EXISTE MAS INCOMPLETO | Sem estorno parcial, sem API de chargeback, `charged_back` ignorado | refunds parciais, chargebacks, status_detail |
| F | Webhooks | EXISTE MAS TEM RISCO | HMAC ok e dedupe por x-request-id, mas `data.id` lido do corpo e `merchant_order` buscado como pagamento (404→5xx→loop) | query `data.id`, tópicos ignorados, status de processamento |
| G | Estados de pedido | EXISTE E FUNCIONA | Allowlist `ORDER_TRANSITIONS` + CAS | inalterado |
| G' | Estados de pagamento | EXISTE MAS INCOMPLETO | Enum com 6 valores, sem máquina de estados/auditoria de transição; sem parcial/disputa | máquina de estados explícita + transições auditadas |
| H | Estoque | EXISTE E FUNCIONA | CAS em `Inventory` (reserve/release/commit) | + diário `InventoryMovement` exatamente-uma-vez |
| I | Reservas | EXISTE MAS TEM RISCO | Expiração ignora pagamento **aprovado** preso (só olha pendente) | não expira pedido com pagamento aprovado |
| J | commitSale | EXISTE MAS TEM RISCO | Pagamento marcado aprovado **antes** da transação do pedido; crash no meio deixa pago+aguardando | detectado/recuperado pela reconciliação |
| K | PaymentReconciliation | EXISTE MAS INCOMPLETO | Fila para órfãos/divergências de webhook, sem motor que compare MP×local×ledger×estoque | motor de reconciliação + `FinancialDiscrepancy` |
| L | Admin | EXISTE MAS INCOMPLETO | Estorno só total, sem motivo/confirmação, lista de reconciliações | área Financeiro com ações controladas |
| M | Jobs/cron | EXISTE E FUNCIONA | Expiração a cada 60 s com lease `SchedulerLock` | + reconciliação diária (desligada por padrão) com lease |
| N | Banco | EXISTE MAS TEM RISCO | Sem unique em `Payment.externalId`; drift: 2 índices do schema ausentes no banco | índice único condicional + índices faltantes |
| O | Segurança | EXISTE E FUNCIONA | JWT por cookie + papel lido do banco, RolesGuard, CORS allowlist, throttler, redaction | + RBAC admin nas rotas novas, confirmação/motivo |
| P | Observabilidade | EXISTE MAS INCOMPLETO | Logs estruturados e `/health`; sem métricas financeiras | health financeiro admin + contadores |

## Evidências por área

### A — Arquitetura — EXISTE E FUNCIONA
- API NestJS; `PrismaModule` global fornece PrismaService/AuditService/InventoryService/`'PaymentProvider'` (`apps/api/src/prisma.module.ts`).
- Provider por env: `createPaymentProviderFromEnv` (`apps/api/src/modules/payments/payment.provider.ts`), `null` proibido em produção Railway.
- Web Next.js com admin em `apps/web/src/app/admin/*`; app Android em `apps/mobile` (WebView — não mexe em dinheiro diretamente).

### B — Checkout — EXISTE E FUNCIONA
- `OrdersService.create` `apps/api/src/modules/orders/orders.service.ts:99`: Idempotency-Key obrigatória (`:100`), escopo `userId:key` (`:101`), unique `Order(userId, idempotencyKey)` (`prisma/schema.prisma:362`).
- Preço vem do banco; produtos demo rejeitados; carrinho de um vendedor só.
- Reserva de estoque dentro da transação (`orders.service.ts:339`), reserva de 30 min.

### C — PIX — EXISTE E FUNCIONA
- `PaymentsService.createIntent` `payments.service.ts:216`; valor PIX = `pixIntentChargeAmount` (`:338`, 95% do total salvo cupom conflitante).
- Chave idempotente `payintent:user:key` + hash do request; índice parcial `Payment_one_pending_per_order` (migração sch003).
- Chamada ao MP com `X-Idempotency-Key: sch-${payment.id}` (`:418`).

### D — Cartão (Mercado Pago Brick) — EXISTE E FUNCIONA
- `cardToken` obrigatório (`payments.service.ts:310`); PAN/CVV nunca chegam ao backend (token do Brick, `:414`).
- Aprovado na criação → `applyProviderStatus` (mesmo caminho do webhook).

### E — Integração Mercado Pago — EXISTE MAS INCOMPLETO
- `translateStatus` mapeia `charged_back` → `unknown` e `in_mediation` → `pending` (`payment.provider.ts:285-286`): chargeback **ignorado**.
- Estorno com chave fixa `sch-refund-${externalId}` (`payment.provider.ts:501`) → impossível fazer 2 estornos parciais.
- Não existia leitura de `status_detail` nem `transaction_amount_refunded`.

### F — Webhooks — EXISTE MAS TEM RISCO
- Assinatura HMAC-SHA256 com manifesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (`payment.provider.ts:546-551`) — **existe**, mas `data.id` vinha do corpo; a doc do MP manda usar o `data.id` da query string.
- Evento persistido em `PaymentEvent` com unique `(provider, providerEventId=x-request-id)` (`schema.prisma:427`, `payments.service.ts:617`) — dedupe **existe**.
- Pagamento sempre re-consultado no MP (fonte da verdade); vínculo por `external_reference = publicId` (`payments.service.ts:693`).
- Órfãos → `PaymentReconciliation` (`:734`).
- **Risco:** notificações `merchant_order`/chargeback eram buscadas como pagamento → 404 → 5xx → MP re-tenta indefinidamente.

### G — Estados de pedido — EXISTE E FUNCIONA
- Allowlist `ORDER_TRANSITIONS` (`apps/api/src/common/order-status.ts:2`), `canTransition` (`:139`).
- `transitionFromAwaiting` (`orders.service.ts:643`) faz CAS + commitSale/release na mesma transação (`:666`, `:674`).

### G' — Estados de pagamento — EXISTE MAS INCOMPLETO
- `enum PaymentStatus { pending approved refused expired cancelled refunded }` (`schema.prisma:58`). Sem estorno parcial, disputa, chargeback; transições não auditadas; `approved`→`refunded` e reversões dependem de `if`s espalhados.

### H — Estoque — EXISTE E FUNCIONA
- CAS: `reserve` `(qtyOnHand - qtyReserved) >= qty` (`inventory.service.ts:16,32`), `release` (`:43`), `commitSale` (`:63`, exige reserva e on-hand).
- Sem diário: impossível provar "baixou exatamente uma vez" depois do fato.

### I — Reservas — EXISTE MAS TEM RISCO
- `expireReservations` (`orders.service.ts:576`) só protege pedido com pagamento **pendente** (grace de 2 h, `reservation-expiry-policy.ts:2`). Pedido com pagamento **aprovado** mas ainda `awaiting_payment` (ver J) seria cancelado e o estoque liberado.

### J — commitSale — EXISTE MAS TEM RISCO
- `applyProviderStatus` grava `Payment.status=approved` (`payments.service.ts:1117`) e **depois** chama `transitionFromAwaiting(...,'paid')` (`:1126`) em outra transação. Crash/timeout entre as duas = dinheiro recebido com pedido aguardando. Se o commitSale falhar, a transação do pedido faz rollback e o mesmo estado fica.

### K — PaymentReconciliation — EXISTE MAS INCOMPLETO
- Modelo `PaymentReconciliation` unique `(provider, externalId)` (`schema.prisma:432,447`), listagem admin `GET /admin/payments/reconciliations` (`admin-payments.controller.ts:16`). Não havia job que comparasse pedido × pagamento × MP × estoque.

### L — Admin — EXISTE MAS INCOMPLETO
- `POST /admin/payments/:id/refund` (`admin-payments.controller.ts:22`): só total, sem motivo, sem confirmação. Continua funcionando igual (não foi alterado).

### M — Jobs/cron — EXISTE E FUNCIONA
- `ReservationsExpiryService` a cada 60 s (`reservations-expiry.service.ts:7`) com lease `SchedulerLock` (`scheduler-lock.ts:23`) — seguro com várias réplicas.

### N — Banco — EXISTE MAS TEM RISCO
- Uniques existentes: `Order(userId,idempotencyKey)`, `PaymentEvent(provider,providerEventId)`, `PaymentReconciliation(provider,externalId)`, índice parcial 1-pendente-por-pedido, `IdempotencyRecord.key`.
- **Falta** unique em `Payment(provider, externalId)`.
- **Drift:** `@@index([orderId])` e `@@index([externalId])` de `Payment` (`schema.prisma:391+`) não existiam no banco gerado pelas migrações (verificado com `prisma migrate diff` no banco local).

### O — Segurança — EXISTE E FUNCIONA
- `JwtAuthGuard` resolve token do cookie/header e **relê o papel no banco** (`jwt-auth.guard.ts:18-34`); `RolesGuard` + `@Roles('admin')`.
- CORS por `CORS_ORIGINS` (`main.ts:28`), helmet (`main.ts:22`), `ValidationPipe` whitelist+forbidNonWhitelisted (`main.ts:34`).
- Throttler global 100/min (`app.module.ts:35`), 20/min intents, 120/min webhook (`payments.controller.ts:21,54`).
- `structuredLog` redige segredos/cvv/token (`structured-log.ts:7`); AuditService remove tokens (`audit.service.ts:11-14`).
- PII: e-mail do comprador vai ao MP como payer (necessário); nenhum dado de cartão armazenado.

### P — Observabilidade — EXISTE MAS INCOMPLETO
- `/health` e `/health/ready` (`health.controller.ts:17,34`); logs JSON estruturados. Sem endpoint/contadores financeiros.

## Estados

- **Pedido** (`OrderStatus`): draft, awaiting_payment, paid, separating*, organizing, packing, ready_for_pickup, shipped*, in_transit, delivered, cancelled, refunded (*legado).
- **Pagamento (legado, mantido)** (`PaymentStatus`): pending, approved, refused, expired, cancelled, refunded.
- **Pagamento (novo, `Payment.financialState`)**: CREATED, PENDING, AUTHORIZED, PAID, FAILED, CANCELLED, EXPIRED, PARTIALLY_REFUNDED, REFUNDED, IN_DISPUTE, CHARGEBACK_WON, CHARGEBACK_LOST.
- **Mapeamento MP → domínio** (`translateStatus`): approved→approved; rejected/cc_rejected*→refused; cancelled→cancelled; expired→expired; refunded→refunded; pending/in_process/in_mediation/authorized→pending; charged_back→unknown (tratado agora pelo motor financeiro via `status`+`status_detail`).

## Variáveis de ambiente relevantes
Existentes: `APP_ENV`, `NODE_ENV`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `REFRESH_COOKIE_*`, `PAYMENTS_PROVIDER`,
`MERCADO_PAGO_ACCESS_TOKEN`/`MP_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`/`MP_WEBHOOK_SECRET`, `MERCADO_PAGO_PUBLIC_KEY`,
`NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`, `PUBLIC_API_URL`, `API_PREFIX`, `CORS_ORIGINS`, `ALLOW_NULL_PROVIDER_IN_PROD`,
`ALLOW_NULL_PAYMENT_SIMULATE`, `MP_MARKETPLACE_SPLIT_ENABLED` (+ flags de split), `PIX_PROMO_COLLIDING_COUPON_CODES`, `RAILWAY_ENVIRONMENT*`.
Novas (todas opcionais, padrão seguro): `FINANCE_REFUNDS_ENABLED` (padrão **off**), `FINANCE_RECONCILIATION_CRON_ENABLED` (padrão **off**),
`FINANCE_RECONCILIATION_AUTO_REPAIR` (padrão off), `FINANCE_RISK_RULES_JSON`, `MERCADO_PAGO_USER_ID` (X-Caller-Id da API de chargebacks),
`MERCADO_PAGO_API_BASE_URL` e `FINANCE_TEST_MODE` (somente testes; a URL é ignorada em produção/staging).

## Endpoints financeiros (main)
`POST /payments/intents` · `GET /payments/order/:orderId` · `GET /payments/:id` · `POST /webhooks/mercadopago` ·
`GET /admin/payments/reconciliations` · `POST /admin/payments/:id/refund` · (null provider, só dev) simulate.

## Condições de corrida encontradas
1. Crash entre `payment.update(approved)` e `transitionFromAwaiting` (J) + expiração de reserva (I) ⇒ pedido pago cancelado e estoque liberado. **Corrigido** (expiração pula aprovado; reconciliação detecta `APPROVED_ORDER_NOT_PAID` CRÍTICA e re-aplica).
2. Webhooks simultâneos do mesmo pagamento: protegidos por CAS no pedido; agora também mutex por pagamento + `SELECT … FOR UPDATE` no estado financeiro (teste: 100 simultâneos ⇒ 1 transição).
3. Dois compradores pela última unidade: CAS impede oversell (teste existente fase-d + novos C06/C07).
4. Estornos simultâneos: não havia trava; agora lock de linha + soma de estornos ativos (teste: 100 ⇒ 1).
5. Duas intenções simultâneas: índice parcial garante 1 pendente (teste C09).

## Estorno e chargeback (main)
- Estorno: só total via admin, chave idempotente fixa por pagamento, `finalizeRefundLocal` faz CAS para refunded, pedido refunded, devolve estoque, reverte comissão. Estorno automático de "aprovado depois de cancelado" era best-effort e silencioso.
- Chargeback: **NÃO EXISTE** (status `charged_back` ignorado).
