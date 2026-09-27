# Observabilidade, logs de erro e alertas (H4)

Objetivo: quando algo quebra, (1) existir um registro com contexto suficiente para achar a causa e
(2) o dono ser avisado se o site, a API ou os pagamentos caírem. Tudo aqui é **grátis** (usa os logs do
Railway e a conta Resend que a loja já usa). Nada muda sem as variáveis de ambiente abaixo.

## 1. O que é registrado (Railway → serviço → Logs)

Todas as linhas são JSON de uma linha. Busque pelo campo `msg`:

| `msg` | Serviço | Quando | Campos |
|---|---|---|---|
| `HTTP_5XX` | `lojas-schimitz` (API) | qualquer resposta ≥ 500 | `requestId`, `method`, `path` (sem query string), `route` (ex. `/api/v1/orders/:id`), `status`, `code`, `errorName`, `errorCode` (ex. Prisma `P1001`), `message`, `stack` (15 frames) |
| `UNHANDLED_REJECTION` / `UNCAUGHT_EXCEPTION` | API | promise sem catch / exceção fora de request (o processo reinicia, como antes) | `errorName`, `message`, `stack` |
| `OPS_ALERT` | API | uma regra de alerta disparou (ver §3) | `alert`, `count`, `threshold`, `windowMin`, `emailed` |
| `WEB_SERVER_ERROR` | `lojas-schimitz-web` | erro ao renderizar uma página/rota no servidor Next | `method`, `path`, `routePath`, `routeType`, `digest`, `message`, `stack` |
| `WEB_CLIENT_ERROR` | API (vem do navegador) | erro JS não tratado no navegador do cliente (tela de erro, `window.onerror`, promise rejeitada) | `kind`, `page` (só o caminho), `message`, `stack`, `digest`, `userAgent` |
| `MONITOR_DOWN` / `MONITOR_UP` / `MONITOR_HEARTBEAT` | `uptime-monitor` (opcional) | alvo caiu / voltou / resumo de hora em hora | `target`, `httpStatus`, … |
| `BACKUP_OK` / `BACKUP_FAILED` | `db-backup` | backup diário (ver `docs/BACKUP_RESTORE.md`) | |
| `WEBHOOK_UNSIGNED_IPN_IGNORED` | API | notificação antiga do MP sem assinatura ("MercadoPago Feed v2.0") — respondida 200 e **ignorada** (nada é gravado nem consultado) | `topic`, `resourceId`, `userAgentFamily` |
| `WEBHOOK_SIGNATURE_REJECTED` | API | webhook recusado antes de processar (401/400) | `reason` (`signature_missing` · `signature_mismatch` · `secret_missing` · `unparseable`), `httpStatus`, `code`, `hasSignature`, `hasRequestId`, `hasDataId`, `topic`, `userAgent` — nunca a assinatura, o `ts`, o segredo ou o corpo |

**Privacidade (LGPD):** mensagens e stacks passam por `maskPii()` — e-mail → `[EMAIL]`, CPF → `[CPF]`,
CNPJ, telefone, cartão, JWT, `Bearer …`, tokens do Mercado Pago (`APP_USR-…`), chaves `re_…`/`sk-…`,
senha em URL de banco (`postgres://[REDACTED]@…`) e parâmetros `token=`/`password=`. Nunca são logados
headers, cookies, corpo da requisição ou query string. Chaves com nome de segredo continuam sendo
removidas por `redactSecrets()`.

**Achar o erro de um cliente:** toda resposta da API agora tem o header `x-request-id` (e o corpo de erro
traz `meta.requestId`). No Railway: Logs → filtro `"requestId":"<id>"`. Na tela de erro do site, o
`digest` liga o `WEB_CLIENT_ERROR` ao `WEB_SERVER_ERROR` correspondente.

Filtros úteis no Railway (caixa de busca dos logs): `HTTP_5XX`, `@level:error`, `OPS_ALERT`,
`WEB_CLIENT_ERROR`, `WEB_SERVER_ERROR`.

## 2. Saúde (para monitores)

| URL | 200 | 503 |
|---|---|---|
| `https://lojasschimitz.com.br/` | site no ar | — |
| `https://lojasschimitz.com.br/api/v1/health` | API viva (sem banco) | — |
| `https://lojasschimitz.com.br/api/v1/health/ready` | API + banco OK | banco fora |
| `https://lojasschimitz.com.br/api/v1/health/payments` | pagamentos OK | pagamentos fora |

`/health/payments` (novo) responde 503 quando: token do Mercado Pago ausente; o Mercado Pago recusa ou não
responde a uma chamada **só de leitura** (`GET /v1/payment_methods` — não cria cobrança); ou houve ≥ 5
falhas ao criar pagamento nos últimos 15 min (`PAYMENTS_HEALTH_MAX_PROVIDER_ERRORS`). A consulta ao MP
fica em cache por 5 min (`PAYMENTS_HEALTH_PING_TTL_SECONDS`), então o endpoint público não "martela" o MP.
O corpo mostra `reasons` (ex. `provider_unauthorized`) e contadores dos últimos 15 min — sem valores,
clientes ou segredos. Obs.: `/api/health` (sem `v1`) não existe — o prefixo da API é `/api/v1`.

## 3. Alertas por e-mail de dentro da API (grátis, opcional)

Desligado por padrão. Liga com uma variável no serviço **lojas-schimitz** (API):

| Variável | Padrão | Efeito |
|---|---|---|
| `OPS_ALERT_EMAIL_TO` | (vazio = desligado) | até 5 e-mails separados por vírgula |
| `OPS_ALERT_5XX_THRESHOLD` | `10` | nº de erros 500 em 5 min para alertar |
| `OPS_ALERT_PROVIDER_ERRORS_THRESHOLD` | `3` | falhas ao criar pagamento no MP em 15 min |
| `OPS_ALERT_WEBHOOK_FAILURES_THRESHOLD` | `10` | falhas ao **processar** webhook autenticado do MP em 15 min (buscar pagamento no MP / aplicar / chargeback). Assinatura rejeitada e IPN sem assinatura **não** contam |
| `OPS_ALERT_COOLDOWN_MINUTES` | `30` | no máximo 1 e-mail por tipo nesse intervalo |

Usa o mesmo envio (Resend) dos e-mails de pedido — plano grátis da Resend: 3.000 e-mails/mês, 100/dia.
Limitação: se a API inteira cair, ela não consegue avisar — para isso servem os monitores do §4.

### Webhooks do Mercado Pago: o que é "falha"

O MP pode mandar dois tipos de aviso para o mesmo pagamento: **Webhook** assinado (`x-signature`,
User-Agent `MercadoPago WebHook v1.0`) e **IPN/Feed** antigo sem assinatura (`MercadoPago Feed v2.0`).
Desde este PR o `notification_url` leva `?source_news=webhooks` (o MP passa a mandar só Webhooks nos
pagamentos novos). O IPN que ainda chegar (pagamentos antigos / retentativas) é respondido **200** e
ignorado — não é possível autenticá-lo, então ele **nunca** muda pagamento, pedido ou estoque. A verdade
continua vindo só do Webhook assinado (+ reconsulta ao MP) e de `POST /admin/finance/payments/:id/reprocess`
/ `POST /admin/finance/reconcile`.

Contadores (`/admin/finance/health` → `process`/`persisted`):
`webhook_unsigned_ipn` (IPN ignorado) · `webhook_unsigned_rejected` (sem assinatura e sem formato de IPN → 401) ·
`webhook_failures` (assinatura presente porém inválida, segredo ausente, evento ilegível **ou** falha de processamento) ·
`webhook_processing_failures` (só fetch/aplicar/chargeback — é o que dispara o alerta e aparece em
`/health/payments` → `recent15m.webhookProcessingFailures`).

## 4. Monitor externo "site/API/pagamentos fora do ar"

### Opção A — UptimeRobot (recomendado, grátis, precisa de conta do dono)
Plano Free: 50 monitores, checagem a cada 5 min, alerta por e-mail (e app). **Precisa do dono:**
criar a conta em https://uptimerobot.com com o e-mail dele e confirmar o e-mail. Depois, criar 3
monitores do tipo **HTTP(s)**:

1. `Lojas Schimitz — site` → `https://lojasschimitz.com.br/`
2. `Lojas Schimitz — API + banco` → `https://lojasschimitz.com.br/api/v1/health/ready`
3. `Lojas Schimitz — pagamentos` → `https://lojasschimitz.com.br/api/v1/health/payments`

Intervalo 5 min; contato de alerta = e-mail do dono. (Alternativa equivalente: Better Stack Uptime free.)
Vantagem: roda fora do Railway, então avisa até se o Railway inteiro cair.

### Opção B — serviço próprio `uptime-monitor` no Railway (sem conta nova)
Código em `infra/uptime-monitor/` (bash + curl + jq, ~5 MB de RAM). Checa os 3 endereços a cada 60 s,
manda e-mail após 3 falhas seguidas, lembra a cada 60 min e avisa quando volta.
**Não foi criado** — criar um serviço é um deploy e precisa do OK do dono. Custo estimado: centavos
por mês (sai dos US$ 5 de uso incluídos no Hobby). Limitação: se o Railway inteiro cair, o monitor cai junto.

Passos (quando aprovado): Railway → New → GitHub repo `lojas-schimitz` → Root Directory
`infra/uptime-monitor` → variáveis:
```
ALERT_EMAIL_TO=<e-mail do dono>
MAIL_FROM=${{lojas-schimitz.MAIL_FROM}}
RESEND_API_KEY=${{lojas-schimitz.RESEND_API_KEY}}
# opcionais: MONITOR_INTERVAL_SECONDS=60 MONITOR_FAIL_THRESHOLD=3 MONITOR_REMIND_MINUTES=60
```
Teste local: `infra/uptime-monitor/test-monitor.sh` (servidores HTTP locais, sem internet, sem e-mail real).

### Falha de deploy no Railway
O Railway manda e-mail de deploy com falha para o dono da conta (Account Settings → Notifications —
conferir se está ligado). Webhook do Railway (Project Settings → Webhooks) precisa de um destino
(Discord/Slack/URL) — só se o dono quiser.

## 5. Sentry (opcional, não instalado)
O plano grátis do Sentry (5 mil erros/mês, 1 usuário) daria agrupamento de erros e stack com source maps.
Não foi instalado para não adicionar dependências/serviço externo sem conta. Se o dono quiser: criar conta
em https://sentry.io, projeto Node (API) e Next.js (web), e passar os DSNs — a integração pode ser feita
num PR separado, ligada só quando `SENTRY_DSN` existir.
