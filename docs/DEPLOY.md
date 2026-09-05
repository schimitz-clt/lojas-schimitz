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
