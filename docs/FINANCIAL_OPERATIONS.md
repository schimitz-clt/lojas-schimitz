# Guia de operação financeira — Lojas Schimitz

Para quem opera o dia a dia (admin). Tudo aqui usa a área **Admin → Financeiro** (`/admin/financeiro`) ou a API
`/admin/finance/*`. Toda ação pede **motivo** e **confirmação** e fica gravada na auditoria financeira (quem, quando, o quê).

## 1. Rotina diária (5 minutos)
1. Abra **Financeiro**. Confira os cartões: *Recebido hoje*, *Pendente*, *Em revisão*, *Estornado*, *Chargebacks abertos*.
2. Linha "Divergências abertas": se houver **Crítica** ou **Alta**, trate antes de separar/enviar pedidos.
3. Veja "Última reconciliação". Se estiver velha (> 24 h), clique **Reconciliar últimas 24h**.
4. Aba **Chargebacks**: confira prazos de documentação (o envio é feito no painel do Mercado Pago).
5. Aba **Estornos**: nada deve ficar em `PROCESSING`/`UNKNOWN` por muito tempo.

## 2. O que significa cada severidade
| Severidade | Significa | O que fazer |
|---|---|---|
| **Crítica** | Dinheiro ou mercadoria em risco (ex.: pago no MP e pedido cancelado, valor diferente, cobrança dupla, estoque inválido) | Não enviar mercadoria até conferir. Resolver manualmente com motivo detalhado. Nunca some sozinha. |
| **Alta** | Inconsistência que exige ação (webhook perdido, estorno travado, estoque sem baixa) | Reprocessar/reconciliar; se persistir, investigar. |
| **Média** | Atraso operacional (reserva vencida sem pagamento, pendente velho) | Some sozinha quando a condição acaba. |
| **Baixa** | Informativa | Nenhuma ação obrigatória. |

"Condição não observada no último run" em Crítica/Alta = o sistema acha que já normalizou, **mas quem fecha é você**.

## 3. Ações disponíveis
| Ação | Quando usar | Efeito |
|---|---|---|
| **Reprocessar** (pagamento) | Webhook atrasou/perdeu | Consulta o pagamento no MP (somente leitura) e aplica pelo mesmo caminho do webhook. Pode repetir sem risco. |
| **Reconciliar** (pagamento / 24h) | Conferência sob demanda | Compara pedido × pagamento × MP × ledger × estoque e abre/atualiza divergências. Só um run global por vez. |
| **Solicitar estorno** | Devolução ao cliente | Total (valor vazio) ou parcial. Nunca acima do saldo. Requer `FINANCE_REFUNDS_ENABLED=true` no servidor. Clique duplo não duplica. |
| **Marcar revisão / Liberar revisão** | Suspeita (regras de risco) | Só sinaliza; não bloqueia nada automaticamente. |
| **Liberar reserva** | Reserva vencida sem pagamento | Só funciona sem pagamento pendente/aprovado. Cancela o pedido e devolve a reserva. |
| **Reconhecer / Resolver** divergência | Após tratar | Reconhecer = "estou vendo"; Resolver = "tratei" (Crítica exige ≥ 30 caracteres). |
| **Ajuste manual de ledger** (`POST /admin/finance/ledger/adjustments`) | Tarifa, diferença conferida no extrato do MP, correção contábil | Cria um lançamento `ADJUSTMENT_CREATED` (CREDIT ou DEBIT) ligado a um pagamento e/ou pedido. Exige motivo, `confirm: true` e header `Idempotency-Key` (mesma chave = mesmo lançamento; mesma chave com outro valor = erro 409). **Não altera** status de pagamento/pedido nem estoque e **não chama** o Mercado Pago. Não existe editar/apagar: um ajuste errado se corrige com outro ajuste no sentido oposto. |

O botão antigo de estorno em Pedidos (`POST /admin/payments/:id/refund`) continua existindo (total). O campo `reason` agora é **aceito e opcional** (compatível com o app atual, que envia `{}`); todo uso fica na auditoria (`payment.legacy_refund_requested`) e a ausência de motivo gera o log `LEGACY_REFUND_WITHOUT_REASON`. Prefira o do Financeiro.

## 4. Playbook de incidentes — DETECTAR → RECUPERAR → RECONCILIAR → ALERTAR → AUDITAR

### 4.1 API fora do ar
- **Detectar:** `/health/ready` falha; Railway mostra deploy/serviço parado; webhooks do MP recebem erro.
- **Recuperar:** reiniciar/redeploy do serviço API no Railway (decisão do dono). O MP re-tenta webhooks automaticamente.
- **Reconciliar:** quando voltar, **Reconciliar últimas 24h** (ou período do incidente via API `scope=PERIOD, from, to`).
- **Alertar:** divergências `APPROVED_NOT_APPLIED` mostram pagamentos que entraram durante a queda.
- **Auditar:** `GET /admin/finance/audit` e `reconciliation-runs` registram o que foi feito.

### 4.2 Webhook fora (MP não entrega / assinatura quebrada)
- **Detectar:** health financeiro `webhookFailuresLast24h` > 0 ou nenhuma notificação nova; logs `WEBHOOK_APPLY_FAILED`; 401 repetidos = segredo errado.
- **Recuperar:** conferir `MERCADO_PAGO_WEBHOOK_SECRET` e URL de notificação no painel do MP.
- **Reconciliar:** Reconciliar 24h; em cada `APPROVED_NOT_APPLIED`, **Reprocessar**.
- **Alertar/Auditar:** divergência `WEBHOOK_FAILURES` (Média) some quando não houver falhas novas.

### 4.3 Timeout do Mercado Pago
- **Detectar:** `provider_errors` subindo no health; checkout mostra erro ao gerar PIX/cartão.
- **Recuperar:** nada a fazer no código: a criação usa `X-Idempotency-Key` — o cliente pode tentar de novo sem cobrança dupla (testado).
  Webhook com erro de consulta devolve 5xx e o MP re-tenta.
- **Reconciliar:** após normalizar, Reconciliar 24h. Estornos em `UNKNOWN` → **retry** (mesma chave no MP).

### 4.4 Banco de dados fora
- **Detectar:** `/health/ready` falha; erros de Prisma nos logs.
- **Recuperar:** restabelecer o Postgres no Railway (não rodar migrações manuais). Webhooks falham com 5xx e o MP re-tenta.
  Medido em teste automatizado (`finance.db-down.db.spec.ts`, Prisma 6.19): depois que o banco volta, a API ainda
  pode responder erro por **~15 segundos** (conexões antigas do pool). É esperado; o MP re-entrega e o resultado final
  é aplicado uma única vez (1 PAID, 1 baixa de estoque, 1 estorno no MP). Se passar de 1 minuto, reinicie o serviço da API.
- **Reconciliar:** Reconciliar o período da queda; conferir `WEBHOOK_FAILURES` e `APPROVED_NOT_APPLIED`.

### 4.5 Webhook atrasado ou duplicado
- Nada a fazer: duplicado (mesmo `x-request-id`) é ignorado; atrasado/fora de ordem sempre reconsulta o MP; transições
  proibidas (ex.: estornado → pago) são bloqueadas e geram `FORBIDDEN_TRANSITION` (Alta) para conferência.

### 4.6 Aprovado no MP mas não recebido pela loja
- **Detectar:** cliente mostra comprovante; divergência `APPROVED_NOT_APPLIED` ou `APPROVED_ORDER_NOT_PAID` (Crítica).
- **Recuperar:** abrir o pagamento → **Reprocessar**. O pedido vai para *pago* e o estoque baixa uma vez.
- Se o pedido já estava **cancelado** (`APPROVED_ON_CANCELLED_ORDER`): decidir entre **estornar** ou atender manualmente; depois **Resolver**.
- Pagamento sem pedido (`PAYMENT_WITHOUT_ORDER`): localizar o cliente pelo id do MP; estornar pelo painel do MP se não houver pedido.

### 4.7 Estorno travado
- **Detectar:** aba Estornos com `PROCESSING` > 30 min ou `UNKNOWN`; divergência `REFUND_STUCK` (Alta).
- **Recuperar:** `UNKNOWN` → **retry** (seguro: mesma chave no MP). `PROCESSING` → Reconciliar com *autoRepair* (reconsulta
  `GET /v1/payments/{id}/refunds`). `FAILED` → ver motivo (`lastError`); tentar novo estorno com nova confirmação.

### 4.8 Estoque reservado sem pagamento
- **Detectar:** `RESERVATION_WITHOUT_PAYMENT` (Média) ou `STOCK_RESERVED_DRIFT` (Alta).
- **Recuperar:** o job de expiração libera sozinho após 30 min (+2 h se houver PIX pendente). Se travou: **Liberar reserva**.
  `STOCK_RESERVED_DRIFT` persistente = investigar (não ajustar estoque na mão sem registrar motivo).

### 4.9 Histórico de pagamentos antigos (backfill do ledger)
Pagamentos criados antes do núcleo financeiro não tinham histórico de estados nem ledger. O comando
`npm run finance:backfill` (em `apps/api`) cria esse histórico **somente com INSERT**, a partir dos dados locais:
- nunca altera status de pagamento/pedido, estoque, nem chama o Mercado Pago;
- sem `--apply` é **simulação** (mostra contagens e divergências, não grava nada);
- com `--apply` em banco remoto exige `FINANCE_BACKFILL_BACKUP_SHA256` (sha256 de um `pg_dump` recém-feito);
- rodar de novo não adiciona nada (chaves determinísticas);
- achados viram **divergências** (sem correção automática) para tratar no painel.

## 5. Configuração (decisão do dono)
| Variável | Padrão | Efeito |
|---|---|---|
| `FINANCE_REFUNDS_ENABLED` | off | Liga estornos pelo Financeiro (chama o MP de verdade em produção). |
| `FINANCE_RECONCILIATION_CRON_ENABLED` | off | Reconciliação diária automática (somente leitura no MP). |
| `FINANCE_RECONCILIATION_AUTO_REPAIR` | off | No cron, re-aplica automaticamente pelo caminho do webhook. |
| `MERCADO_PAGO_USER_ID` | vazio | Necessário para consultar chargebacks (`X-Caller-Id`). |
| `FINANCE_RISK_RULES_JSON` | padrões | Ajusta limites das regras de risco. |

## 6. O que o sistema **não** faz (de propósito)
- Não envia documentação de chargeback (fazer no painel do MP).
- Não bloqueia pedidos por risco automaticamente.
- Não ajusta estoque ou valores sem ação humana registrada.
- Não guarda dados de cartão (só token do Brick, usado uma vez).
