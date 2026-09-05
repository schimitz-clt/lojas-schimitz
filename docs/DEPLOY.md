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
