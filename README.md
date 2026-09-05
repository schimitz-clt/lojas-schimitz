# Lojas Schimitz — SCH-002

Plataforma própria. **SCH-001 fundação + SCH-002 hardening.**

A vitrine Netlify atual **permanece no ar**.

- Vitrine: https://tangerine-kulfi-2a165e.netlify.app
- Este repo: API NestJS + Prisma + loja Next.js

## Status

| Módulo | Status |
|---|---|
| Auth Argon2 + JWT + refresh | Revisado SCH-002 |
| Rate limiting | Ativo (global + auth/pedidos) |
| Carrinho | Revisado (preço/estoque no backend) |
| Checkout | Recalcula no servidor + idempotency |
| Estoque atômico | SCH-002 |
| Reserva / cancelamento / expiração 30 min | SCH-002 |
| Cupom reserved vs used | SCH-002 |
| Pagamento Mercado Pago | TODO SCH-003 |
| Frete real | TODO SCH-004 |
| Admin profissional | TODO SCH-005 |

## Subir no computador

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
cd apps/api && npm install
npx prisma migrate dev --schema=../../prisma/schema.prisma
# ou aplique prisma/migrations/20260826_sch002/migration.sql
npm run prisma:seed
npm run test
npm run start:dev
```

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

- API: http://localhost:3001/api/v1/health
- Loja: http://localhost:3000
- Checkout: http://localhost:3000/checkout

Documentação: `docs/SCH-002.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`.
