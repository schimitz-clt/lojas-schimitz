# Arquitetura do núcleo financeiro (COMANDO OMEGA)

Evolução **aditiva**: nenhum fluxo existente foi reescrito. `Payment.status` (enum legado) continua sendo a
autoridade do domínio de pedidos; o núcleo financeiro adiciona estado explícito, ledger, auditoria,
reconciliação, estornos, chargebacks, risco e observabilidade ao redor dele.

## Módulos (`apps/api/src/modules/finance/`)
| Arquivo | Papel |
|---|---|
| `payment-state-machine.ts` | Estados + allowlist `PAYMENT_TRANSITIONS`; `targetPaymentState` (legado + observação do MP) |
| `financial-recorder.service.ts` | `syncPaymentState` (transação + `SELECT … FOR UPDATE`), ledger, auditoria, discrepâncias |
| `refunds.service.ts` | Estorno total/parcial idempotente |
| `chargebacks.service.ts` | Casos de chargeback (webhook `topic_chargebacks_wh` + status do pagamento) |
| `reconciliation-checks.ts` / `reconciliation.service.ts` | Regras puras + motor com lock |
| `reconciliation.scheduler.ts` | Execução diária (desligada por padrão) |
| `risk-engine.ts` / `risk.service.ts` | Regras determinísticas (não é ML), só ALLOW/REVIEW |
| `finance-admin.controller.ts` / `finance-admin.service.ts` | API admin `/admin/finance/*` |
| `finance-metrics.ts` | Contadores em memória por réplica |
| `keyed-mutex.ts` | Serializa trabalho por pagamento dentro de uma réplica |
| `testing/fake-mercadopago.server.ts` | **Somente teste**: servidor HTTP local fake do MP |

## Máquina de estados do pagamento
```
CREATED → PENDING → AUTHORIZED → PAID → PARTIALLY_REFUNDED → REFUNDED
   │         │           │         ├──→ IN_DISPUTE → CHARGEBACK_WON / CHARGEBACK_LOST / PAID
   └─────────┴───────────┴──→ FAILED | CANCELLED | EXPIRED        (CANCELLED/EXPIRED → PAID = captura tardia)
```
Proibidas (auditadas + discrepância HIGH `FORBIDDEN_TRANSITION`, nunca aplicadas): REFUNDED→PAID, CHARGEBACK_LOST→PAID,
FAILED→PAID, PARTIALLY_REFUNDED→PAID, qualquer saída de estado terminal. Mesmo estado = no-op idempotente.
EXPIRED/CANCELLED→PAID é permitido porque um PIX pode liquidar depois da expiração: o dinheiro é real, o ledger registra e a
reconciliação abre `APPROVED_ON_CANCELLED_ORDER` CRÍTICA.

Cada transição grava `PaymentStateTransition` (unique `paymentId+eventKey`), `FinancialAuditEvent` e lançamentos de ledger com
chave determinística.

## Idempotência (camadas)
| Operação | Garantia |
|---|---|
| Criar pedido | Idempotency-Key + unique `Order(userId,idempotencyKey)` (existente) |
| Criar pagamento | `IdempotencyRecord` + índice parcial 1-pendente + `X-Idempotency-Key sch-<paymentId>` no MP (existente) + unique condicional `Payment(provider,externalId)` (novo) |
| Webhook | unique `PaymentEvent(provider,providerEventId)`; `attempts` incrementa; re-fetch no MP; mutex por pagamento; lock de linha no sync |
| Confirmação / commitSale | CAS no pedido (existente) + `InventoryMovement` unique `(orderItemId, kind)` (novo) |
| Estorno | unique `PaymentRefund.idempotencyKey` (escopo pagamento) + `(provider, providerRefundId)`; `X-Idempotency-Key sch-refund-<refundId>`; lock de linha no Payment |
| Ledger | unique `idempotencyKey` (ex.: `PAYMENT_CAPTURED:<paymentId>`) + `createMany skipDuplicates` |
| Reconciliação | lease `SchedulerLock` (`finrecon:global` / `finrecon:payment:<id>` / `finrecon:order:<id>`); `FinancialDiscrepancy.dedupeKey` unique |

## Webhook
1. Verifica HMAC `x-signature` (manifesto oficial com `data.id` da **query**; fallbacks documentados: id minúsculo e pares ausentes omitidos).
2. Persiste evento mínimo (`notificationId`, `dataId`, `action`, `processingStatus`, `attempts`).
3. Tópicos não-pagamento (`merchant_order`, etc.) ⇒ `IGNORED` (200, sem fetch). Chargebacks ⇒ `ChargebacksService`.
4. Sempre `GET /v1/payments/{id}` (fonte da verdade) — ordem de chegada não importa.
5. Aplica via `applyProviderStatus` (caminho legado) e depois `syncFinancialAfterProviderFetch` (estado/ledger/chargeback/risco), serializado por pagamento.
6. Resultado: `PROCESSED`, `NOT_APPLIED`, `RECONCILIATION_REQUIRED`, `IGNORED` ou `FAILED` (erro ⇒ 5xx ⇒ MP re-tenta com o mesmo x-request-id).

## Ledger (append-only)
Tipos: `PAYMENT_CREATED`(NONE), `PAYMENT_CAPTURED`(CREDIT), `PAYMENT_FAILED`, `PAYMENT_CANCELLED`, `PAYMENT_EXPIRED`(NONE),
`REFUND_CREATED`(NONE), `REFUND_COMPLETED`(DEBIT), `REFUND_FAILED`(NONE), `CHARGEBACK_OPENED`(NONE), `CHARGEBACK_WON`(NONE), `CHARGEBACK_LOST`(DEBIT), `ADJUSTMENT_CREATED` (tipo reservado; ainda não há endpoint de ajuste manual — decisão do dono).
Triggers Postgres `financial_append_only_guard` bloqueiam UPDATE/DELETE em `FinancialLedgerEntry`, `FinancialAuditEvent`,
`PaymentStateTransition`, `InventoryMovement`. Sem FKs para Order/Payment: um cascade nunca apaga histórico financeiro.

## Reconciliação
Escopos: ORDER, PAYMENT, PERIOD (on-demand admin), DAILY (cron, opt-in). Compara pedido × pagamento local × pagamento no MP
(GET somente leitura) × ledger × estornos × estoque/diário. Tipos de divergência:
`APPROVED_NOT_APPLIED`(HIGH), `PENDING_STALE`(MED), `REFUND_NOT_APPLIED`(HIGH), `LOCAL_APPROVED_PROVIDER_NOT`(CRIT), `AMOUNT_MISMATCH`(CRIT),
`REFUND_AMOUNT_MISMATCH`(HIGH), `APPROVED_ORDER_NOT_PAID`(CRIT), `APPROVED_ON_CANCELLED_ORDER`(CRIT), `LEDGER_MISSING_CAPTURE`(MED),
`LEDGER_BALANCE_MISMATCH`(HIGH), `REFUND_STUCK`(HIGH), `DOUBLE_PAYMENT`(CRIT), `ORDER_PAID_WITHOUT_PAYMENT`(CRIT),
`RESERVATION_WITHOUT_PAYMENT`(MED), `STOCK_NOT_COMMITTED`(HIGH), `STOCK_NOT_RELEASED`(HIGH), `STOCK_COMMIT_AND_RELEASE`(CRIT),
`STOCK_INVALID`(CRIT), `STOCK_RESERVED_DRIFT`(HIGH), `DUPLICATE_EXTERNAL_ID`(CRIT), `PAYMENT_WITHOUT_ORDER`, `PROVIDER_INTEGRITY_MISMATCH`(CRIT),
`WEBHOOK_FAILURES`(MED), `FORBIDDEN_TRANSITION`(HIGH), `CHARGEBACK_OPEN`/`CHARGEBACK_FETCH_FAILED`(HIGH).

Quando a condição some: LOW/MEDIUM são resolvidas automaticamente (auditado); HIGH/CRITICAL só ganham `conditionCleared=true` —
**um humano precisa resolver** (CRITICAL exige motivo ≥ 30 caracteres). `autoRepair` (opcional) só usa caminhos seguros:
re-aplicar o status do MP pelo mesmo caminho do webhook, backfill de ledger, e reconsultar estorno em processamento.

## Estornos (capacidades verificadas na doc oficial do MP)
`POST /v1/payments/{id}/refunds` com `X-Idempotency-Key`; `amount` ⇒ parcial, sem corpo ⇒ total; `GET /v1/payments/{id}/refunds`.
Fluxo: `requestRefund` (flag `FINANCE_REFUNDS_ENABLED`, motivo ≥10, Idempotency-Key, lock de linha, `refundável = pago − estornos ativos − estornos já vistos no MP`,
`REFUND_EXCEEDS_PAID`) → `execute` (CAS→PROCESSING, chamada ao MP; 4xx ⇒ FAILED; 5xx/rede ⇒ UNKNOWN para retry com a mesma chave)
→ COMPLETED grava `REFUND_COMPLETED`; total chama `finalizeRefundLocal` (pedido refunded, estoque de volta 1×, comissão revertida);
parcial ⇒ `PARTIALLY_REFUNDED`. `in_process` fica PROCESSING até a reconciliação reconsultar.
O endpoint legado `POST /admin/payments/:id/refund` **não foi alterado**.

## Chargebacks (capacidades verificadas)
Notificação `topic_chargebacks_wh` (`data.id` = case id) + `GET /v1/chargebacks/{id}` (exige `X-Caller-Id` = `MERCADO_PAGO_USER_ID`);
status do pagamento `charged_back` com `status_detail` `settled` (perdido) / `reimbursed` (coberto) / `in_process`; `in_mediation` ⇒ disputa.
Envio de documentação **não** é automatizado (feito no painel do MP) — documentado, não simulado.

## Estoque
PENDENTE ≠ PAGO ≠ VENDA COMMITADA: reserva no checkout (`RESERVE`), baixa na confirmação (`COMMIT`), liberação em falha/expiração
(`RELEASE`), devolução em estorno total (`RESTOCK`). Cada movimento é único por item de pedido; repetição é no-op antes de mexer
em `Inventory`. A expiração de reservas agora ignora pedidos com pagamento aprovado.

## Risco (regras, não ML)
R001 valor alto · R002 conta nova + valor alto · R003 recusas repetidas · R004 velocidade de pedidos · R005 reconciliação aberta · R006 chargeback anterior.
Configurável por `FINANCE_RISK_RULES_JSON`. Grava `RiskAssessment` (regra, motivo, decisão). REVIEW só marca `reviewStatus=UNDER_REVIEW`; nunca bloqueia.

## Banco (migração `20260927_financial_core`, somente aditiva)
Colunas novas (nullable/default): `Payment.financialState`, `financialStateAt`, `reviewStatus`; `PaymentEvent.notificationId`, `dataId`, `action`,
`processingStatus`, `attempts` (default 0), `lastError`, `processedAt`.
Tabelas novas: `PaymentStateTransition`, `FinancialLedgerEntry`, `FinancialAuditEvent`, `PaymentRefund`, `Chargeback`,
`FinancialDiscrepancy`, `FinancialReconciliationRun`, `RiskAssessment`, `InventoryMovement`.
Índices: os do schema que faltavam (`Payment_orderId_idx`, `Payment_externalId_idx`), índices de consulta das tabelas novas, e
`Payment_provider_externalId_unique` **condicional** (bloco DO: só cria se não houver duplicatas; senão NOTICE e segue — a
reconciliação reporta `DUPLICATE_EXTERNAL_ID`). Nenhum DROP/DELETE/UPDATE de dados.

## Observabilidade
`GET /admin/finance/health` (admin): contagens duráveis do banco (webhooks 24h, falhas, duplicatas, divergências por severidade,
chargebacks, estornos em voo, fila de órfãos, última reconciliação) + contadores do processo (`payments_created/paid/failed/pending/expired`,
`refunds_*`, `chargebacks_*`, `discrepancies_created`, `webhook_received/duplicates/failures/ignored_topic`, `provider_errors`,
`forbidden_transitions`, `reconciliation_runs`). Logs estruturados: `FINANCIAL_DISCREPANCY`, `WEBHOOK_APPLY_FAILED`,
`FINANCIAL_RECONCILIATION_DONE/FAILED`, `REFUND_*`.

## Endpoints novos (todos `@Roles('admin')`)
GET `/admin/finance/health`, `/dashboard`, `/payments`, `/payments/:id`, `/discrepancies`, `/chargebacks`, `/refunds`, `/ledger`, `/audit`, `/reconciliation-runs`.
POST (corpo `{ reason ≥10, confirm: true }`): `/reconcile`, `/payments/:id/reprocess`, `/payments/:id/refunds` (+ header `Idempotency-Key`),
`/refunds/:id/retry`, `/orders/:id/release-reservation`, `/payments/:id/review`, `/discrepancies/:id/resolve`,
`/ledger/adjustments` (+ header `Idempotency-Key`; corpo `{ direction: CREDIT|DEBIT, amount, paymentId?, orderId? }`).

## Ajuste manual (ADJUSTMENT_CREATED)
`FinanceAdminService.createAdjustment`: chave `ADJUSTMENT_CREATED:<Idempotency-Key>` (unique no ledger). Replay com o
mesmo conteúdo devolve o mesmo lançamento (sem nova auditoria); conteúdo diferente → 409 `IDEMPOTENCY_KEY_REUSED`.
Lançamento + `FinancialAuditEvent` na mesma transação. Não entra no cálculo de captura/estorno da reconciliação.

## Backfill do histórico legado (`legacy-backfill.ts` + `legacy-backfill.cli.ts`)
Para pagamentos sem transições: caminho de estados válido pela máquina (`CREATED|PENDING → … → estado atual`),
transição inicial com `eventKey = 'created'` (o gravador ao vivo reconhece) e demais `backfill:<i>:<estado>`;
ledger com as MESMAS chaves do gravador ao vivo (`PAYMENT_CAPTURED:<id>` etc.) → nunca duplica. Somente INSERT
(`createMany skipDuplicates`), lock de linha `FOR UPDATE` sem escrita no Payment, PrismaClient avulso (não sobe o
Nest → nenhum job roda). `syncPaymentState` passou a usar a última transição registrada como estado de origem
quando `financialState` é nulo (senão a aprovação de um pagamento legado não geraria transição/captura).

## Testes HTTP e de queda de banco
- `finance.e2e.db.spec.ts`: compila a API com `tsc` (metadados de decorator → `ValidationPipe` igual produção) e faz
  requisições HTTP reais (fetch nativo): checkout → PIX → webhook assinado → PAID → baixa; cartão recusado; 401/403;
  400 sem `confirm`/motivo; ajuste manual; throttle; estorno legado.
- `finance.db-down.db.spec.ts`: proxy TCP "desligável" entre a API e o Postgres local; derruba o banco no meio do fluxo.
