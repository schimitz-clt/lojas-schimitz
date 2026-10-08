# Lojas Schimitz

Plataforma própria de e-commerce da Lojas Schimitz (Porto Alegre): loja online, painel de administração,
pagamentos Mercado Pago (PIX + cartão), marketplace v1 e apps Android.

Produção: https://lojasschimitz.com.br (Railway).

## Stack

| Parte | Tecnologia | Pasta |
|---|---|---|
| API | NestJS 10 + Prisma 6 + PostgreSQL (Node 22, Docker) | `apps/api`, `prisma/` |
| Loja + painel `/admin` | Next.js 15 + React 19 | `apps/web` |
| Apps Android (WebView) | Kotlin — app da loja e app só da administração | `apps/mobile` |
| Backup | Cron diário `pg_dump` + fotos, criptografado (age), bucket Railway | `infra/db-backup` |
| Monitor de uptime (opcional, não criado) | Serviço Railway | `infra/uptime-monitor` |

Integrações: Mercado Pago (Payments API + Card Payment Brick + PIX, webhook HMAC), Resend (e-mail HTTP),
Firebase Cloud Messaging (push), Melhor Envio (cotação de frete), OpenAI (chat, opcional).
WhatsApp é só clique-para-conversar (`wa.me`), sem Cloud API.

## O que já existe

- Conta e login (Argon2 + JWT + refresh em cookie HttpOnly), cadastro com CPF, recuperação de senha.
- Carrinho e checkout recalculados no servidor, Idempotency-Key, estoque atômico, reserva de 30 min com expiração automática.
- Pagamentos Mercado Pago: PIX (com desconto PIX) e cartão; webhook assinado e idempotente.
- Núcleo financeiro: ledger append-only, estorno total/parcial, chargeback, reconciliação, métricas.
- Frete híbrido: cotação Melhor Envio + regras por CEP (POA grátis). Etiqueta e rastreio continuam manuais.
- Página do pedido com PIX/cartão e status atualizando sozinho (sem F5).
- Painel `/admin`: pedidos, catálogo e fotos, financeiro, cupons, banners/SEO, notificações push, multi-admin.
- Marketplace v1 (vendedores, comissão, portal, repasse manual). Split Mercado Pago no código, **desligado por flag**.
- Push FCM (campanhas, recuperação de produto visto), e-mails transacionais, chat, wishlist, avaliações, cashback.
- Observabilidade (logs 5xx com contexto, `/api/v1/health`, `/api/v1/health/payments`, alertas) e backup diário.

Detalhes por área em `docs/` (veja "Documentação" abaixo).

## Rodar no computador

Pré-requisitos: Node 22, npm, PostgreSQL 16+ (ou Docker).

```bash
# 1. Banco (Docker) — ou use um Postgres local com usuário/senha schimitz
docker compose -f infra/docker-compose.yml up -d

# 2. API
cp .env.example .env            # preencha os valores (nunca commitar)
npm install                     # raiz: Prisma
cd apps/api
npm install
npm run prisma:generate
npx prisma migrate deploy --schema=../../prisma/schema.prisma
npm run prisma:seed             # admin + catálogo de exemplo (só local)
npm run start:dev               # http://localhost:3001/api/v1/health

# 3. Loja (outro terminal)
cd apps/web
cp .env.example .env.local
npm ci                          # usa o package-lock.json (versões fixas)
npm run dev                     # http://localhost:3000
```

App Android: ver `apps/mobile/README.md` (build local; publicação na Play Console é feita pelo dono).

## Testes e build

```bash
# Loja
cd apps/web
npm run build
npm test                 # specs em src/lib/*.spec.ts (tsx)
npx tsc --noEmit

# API
cd apps/api
npm run build
npm test                 # unitários + specs *.db.spec.ts
```

Os specs `*.db.spec.ts` e `payment.integration.spec.ts` precisam de **Postgres local** com as migrations aplicadas
(`DATABASE_URL=postgresql://…@127.0.0.1:5432/…`). Eles recusam URL que não seja local (nunca apontar para o Railway).
Os specs de finanças fazem checkout real, então também precisam de cotação de frete:
`MELHOR_ENVIO_TOKEN` + `MELHOR_ENVIO_BASE_URL` (token de sandbox ou um servidor falso local).
Servidor falso pronto: `node .github/ci/fake-melhor-envio.mjs &` e depois
`MELHOR_ENVIO_TOKEN=fake-local MELHOR_ENVIO_BASE_URL=http://127.0.0.1:45999`.

CI: `.github/workflows/ci.yml` roda tudo isso (web + API com Postgres de serviço) em cada PR e push no `main`,
sem nenhum segredo.

Suítes por tema: `npm run test:security`, `test:finance`, `test:sch003` … `test:sch006` (ver `apps/api/package.json`).
`npm run test:sandbox` chama o sandbox real do Mercado Pago (credenciais de teste) — não roda por padrão.

## Deploy (Railway)

Projeto Railway com ambientes `production` e `staging`. Push no `main` publica em produção.

| Serviço | Origem | Build |
|---|---|---|
| `lojas-schimitz` (API) | raiz do repo, `railway.toml` | Dockerfile `apps/api/Dockerfile` (`/Dockerfile` é cópia idêntica). Start roda `prisma migrate deploy` + `node dist/main.js`. Healthcheck `/api/v1/health`. Volume em `/data/uploads` (fotos) |
| `lojas-schimitz-web` | root directory `apps/web`, `apps/web/railway.toml` | Railpack: `npm install && npm run build`, start `npm run start`. Healthcheck `/` |
| `Postgres` | Railway | volume próprio |
| `db-backup` | `infra/db-backup` | cron `15 6 * * *` (UTC) → bucket `db-backups` |

A API só rebuilda quando mudam `apps/api/**`, `prisma/**` ou arquivos de build da raiz (`watchPatterns`);
deploy da API "SKIPPED" em commit só do web é normal.

Guias: `docs/DEPLOY.md`, `docs/BACKUP_RESTORE.md`, `docs/OBSERVABILITY.md`, `docs/SECURITY.md`.

## Variáveis de ambiente (só nomes — valores ficam no Railway / `.env` local)

**API** (`lojas-schimitz`), modelo em `.env.example`:

- Base: `APP_ENV`, `NODE_ENV`, `PORT`, `API_PREFIX`, `DATABASE_URL`, `CORS_ORIGINS`, `SITE_URL`, `APP_URL`, `PUBLIC_API_URL`, `UPLOADS_DIR`
- Auth: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`, `REFRESH_COOKIE_*`, `REFRESH_JSON_TOKEN_ENABLED`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (seed)
- Pagamentos: `PAYMENTS_PROVIDER`, `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_PUBLIC_KEY`, `MERCADO_PAGO_WEBHOOK_SECRET`, `FINANCE_REFUNDS_ENABLED`, `PIX_PROMO_COLLIDING_COUPON_CODES`
- Marketplace (desligado): `MP_MARKETPLACE_SPLIT_ENABLED`, `MP_MARKETPLACE_SPLIT_ALLOW_LIVE`, `MP_MARKETPLACE_CLIENT_ID`, `MP_MARKETPLACE_CLIENT_SECRET`, `MP_MARKETPLACE_REDIRECT_URI`, `MP_OAUTH_STATE_SECRET`, `MP_SELLER_CREDENTIAL_KEY`
- Frete: `CARRIER_PROVIDER`, `MELHOR_ENVIO_TOKEN` (ou `MELHOR_ENVIO_ACCESS_TOKEN`), `MELHOR_ENVIO_ORIGIN_CEP`, `MELHOR_ENVIO_SANDBOX`, `MELHOR_ENVIO_BASE_URL`, `MELHOR_ENVIO_USER_AGENT`
- E-mail: `RESEND_API_KEY`, `MAIL_FROM`, `STORE_NOTIFY_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- Push: `FIREBASE_SERVICE_ACCOUNT_JSON` ou `FIREBASE_SERVICE_ACCOUNT_BASE64`, `FIREBASE_PROJECT_ID`, `ABANDONED_VIEW_DELAY_HOURS`, `ABANDONED_VIEW_MAX_AGE_HOURS`
- Chat (opcional): `OPENAI_API_KEY` ou `CHAT_API_KEY`, `CHAT_API_BASE`, `CHAT_MODEL`, `CHAT_AI_MODE`, `SCHIMITZ_AI_ENABLED`
- Outros: `REDIS_URL`, `SWAGGER_ENABLED`, `WHATSAPP_PHONE`

**Web** (`lojas-schimitz-web`), modelo em `apps/web/.env.example`:
`NEXT_PUBLIC_API_URL`, `API_PROXY_TARGET`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WHATSAPP`,
`NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_META_PIXEL_ID`.

**db-backup:** `DATABASE_URL`, `BACKUP_AGE_RECIPIENT`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_REGION`,
`BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`. A chave privada age **não** fica no Railway nem no GitHub
(guardar offline — sem ela os backups não abrem).

**Nunca definir em produção** (só desenvolvimento): `ALLOW_NULL_PAYMENT_SIMULATE`, `ALLOW_NULL_PROVIDER_IN_PROD`,
`NULL_WEBHOOK_SECRET`, `NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE`, `NEXT_PUBLIC_NULL_WEBHOOK_SECRET`.

## Documentação

- Arquitetura e API: `docs/ARCHITECTURE.md`, `docs/API.md`
- Segurança: `docs/SECURITY.md`, `docs/SECURITY-HARDENING-2026-09-18.md`, `docs/SECURITY-CSP-2026-09-19.md`
- Pagamentos e finanças: `docs/FINANCIAL_ARCHITECTURE.md`, `docs/FINANCIAL_OPERATIONS.md`, `docs/PIX-DISCOUNT.md`
- Marketplace: `docs/MARKETPLACE.md`, `docs/MARKETPLACE-MP-SPLIT-PLAN.md`
- Operação: `docs/DEPLOY.md`, `docs/BACKUP_RESTORE.md`, `docs/OBSERVABILITY.md`, `docs/PUSH-FCM.md`, `docs/WHATSAPP.md`, `docs/CHAT.md`
- Histórico das fases (SCH-00x, MEGA-PHASE-xx, auditorias): demais arquivos em `docs/` — registro do que foi feito em cada etapa, não necessariamente o estado atual.
