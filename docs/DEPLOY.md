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


## E-mail (SMTP) — cliente e loja

Notificações ao **cliente**: **Pedido pago** (webhook/aprovação) e **Saiu para entrega**
(admin muda status para `shipped`). Opcional: **Pedido entregue** (`delivered`).

Notificações à **loja** (todos os admins ativos, e-mail do cadastro — ex. `schimitzclaiton@gmail.com`):
**Nova venda paga** no confirmamento de pagamento, **sempre** — inclusive se o comprador
também for admin. O e-mail inclui link `/admin` e deep link `wa.me` (click-to-chat;
**não** envia WhatsApp sozinho — ver `docs/WHATSAPP.md`). In-app 🔔 **Novo pagamento**
em `/notificacoes` para cada admin ativo.

Se `MAIL_FROM` + (`RESEND_API_KEY` **ou** SMTP) não estiverem definidos, a API **não envia**
e-mail (apenas log) e **não falha** o pagamento/fulfillment — a notificação in-app da loja
ainda é criada.

**Railway:** egress SMTP costuma falhar (`ETIMEDOUT` em Gmail / `smtp.resend.com:465`).
Use **Resend HTTP API** (`POST https://api.resend.com/emails`) — não depende de porta 465/587.

Variáveis no serviço da API (Railway → Variables):

| Variável | Exemplo | Notas |
|----------|---------|--------|
| `RESEND_API_KEY` | `re_…` | Preferido no Railway; Bearer no HTTPS |
| `MAIL_FROM` | `Lojas Schimitz <onboarding@resend.dev>` | Remetente; domínio verificado em prod |
| `SMTP_HOST` | `smtp.gmail.com` / `smtp.resend.com` | Fallback SMTP se Resend HTTP não ativo |
| `SMTP_PORT` | `587` ou `465` | Padrão 587 |
| `SMTP_USER` | conta / `resend` | Com `SMTP_PASS` se o provedor exigir auth |
| `SMTP_PASS` | app password / `re_…` | **Nunca** commit; dual-use: se começa com `re_` e host tem `resend`, vira Resend HTTP |

Provedores:

- **Resend HTTP (recomendado no Railway):** `RESEND_API_KEY` + `MAIL_FROM`. Ou só `SMTP_HOST=smtp.resend.com` + `SMTP_PASS=re_…` (mesma chave, path HTTPS).
- **Gmail SMTP:** só se o ambiente permitir egress SMTP (local/VPS); no Railway tende a timeout.
- Outro SMTP: host/porta/user/pass do painel (fallback nodemailer).

Após setar as variáveis, faça redeploy do serviço da API.


## WhatsApp (clique-para-conversar)

Não é Cloud API. Sem tokens Meta/Twilio.

No serviço **web**, defina:

```
NEXT_PUBLIC_WHATSAPP=5551996253766
```

Os botões do admin (`Avisar no WhatsApp`, `Cliente pagou — abrir WhatsApp`)
abrem `wa.me` com a mensagem pronta. Detalhes: `docs/WHATSAPP.md`.

## Chat IA (Phase 1)

No servico da API (opcional): OPENAI_API_KEY ou CHAT_API_KEY, CHAT_API_BASE, CHAT_MODEL.
Sem chave o widget continua: FAQ das politicas + link WhatsApp.
Rate limit proprio 20/min. Ver docs/CHAT.md.


## Verificação e-mail / notificações (OWNER)

Checklist:

1. Railway API: `RESEND_API_KEY` (ou dual-use `SMTP_PASS=re_…` + host resend) + `MAIL_FROM`.
2. `POST /auth/forgot-password` com e-mail de teste → mensagem genérica na API; log `E-mail enviado via Resend HTTP` (não `ETIMEDOUT`).
3. Pedido pago (null simulate local ou PIX live autorizado) → e-mail cliente + aviso admin (`STORE_NOTIFY_EMAIL`).
4. Sem `OPENAI_API_KEY` o chat usa FAQ; billing OpenAI é OWNER.
5. Fotos de produto reais e Play Console / assetlinks: OWNER.
