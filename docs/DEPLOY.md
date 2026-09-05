# Deploy (Railway) — Lojas Schimitz API

## Visao geral

Build explicito da API via railway.toml na raiz do monorepo.
Evita deteccao incorreta como multi-app Nx/Next.

## Variaveis

Nao commitar .env. Configure no Railway: DATABASE_URL, JWT_ACCESS_SECRET,
JWT_REFRESH_SECRET, CORS_ORIGINS, PORT e demais chaves de .env.example.

## Pipeline

1. Install (raiz + apps/api), generate Prisma, build TypeScript
2. Start: aplicacao de migrations e node dist/main.js
3. Healthcheck: /api/v1/health

## Notas

- Sem segredos no git
- Contexto de build ignora apps/web e node_modules


## Uploads de imagens (admin)

Arquivos vão para `UPLOADS_DIR` (padrão no Docker: `/data/uploads`) e são
servidos em `GET /api/v1/uploads/:filename`.

**Railway (recomendado):** adicione um Volume montado em `/data/uploads` no
serviço da API. Sem volume, as fotos somem no redeploy (disco efêmero).

Variáveis:
- `UPLOADS_DIR=/data/uploads`
- `PUBLIC_API_URL=https://<sua-api>.up.railway.app/api/v1` (links absolutos estáveis)
- CORS já cobre o admin/web via `CORS_ORIGINS`

R2/S3 permanece plano futuro (ARCHITECTURE.md); este caminho não exige credenciais de cloud.


## E-mail ao cliente (SMTP)

Notificações: **Pedido pago** (webhook/aprovação) e **Saiu para entrega**
(admin muda status para `shipped`). Opcional: **Pedido entregue** (`delivered`).

Se `SMTP_HOST` ou `MAIL_FROM` não estiverem definidos, a API **não envia** e-mail
(apenas log) e **não falha** o pagamento/fulfillment.

Variáveis no serviço da API (Railway → Variables):

| Variável | Exemplo | Notas |
|----------|---------|--------|
| `SMTP_HOST` | `smtp.gmail.com` ou `smtp.resend.com` | Obrigatório para enviar |
| `SMTP_PORT` | `587` (STARTTLS) ou `465` (SSL) | Padrão 587 |
| `SMTP_USER` | conta / API user | Com `SMTP_PASS` se o provedor exigir auth |
| `SMTP_PASS` | app password / API key | **Nunca** commit; só no Railway |
| `MAIL_FROM` | `Lojas Schimitz <loja@seudominio.com>` | Remetente visível |

Provedores comuns (escolha um; configure só as env):

- **Gmail**: `SMTP_HOST=smtp.gmail.com`, porta `587`, use [App Password](https://support.google.com/accounts/answer/185833) (conta com 2FA).
- **Resend SMTP**: `SMTP_HOST=smtp.resend.com`, user `resend`, pass = API key; `MAIL_FROM` com domínio verificado.
- Outro SMTP (SendGrid, Amazon SES, provedor do domínio): use host/porta/user/pass do painel.

Após setar as variáveis, faça redeploy do serviço da API.
