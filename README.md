# Lojas Schimitz — SCH-002

Plataforma própria. **SCH-001 fundação + SCH-002 hardening.**

Loja Next.js no ar. Chat IA Phase 1 no site (FAQ + catalogo + WhatsApp).

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
| Chat IA (widget + POST /chat) | Phase 1 |

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

App Android (WebView): `apps/mobile` — ver `apps/mobile/README.md` (build local / Play Console; nós não fazemos upload).

Documentação: `docs/SCH-002.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/WHATSAPP.md`, `docs/CHAT.md`.

WhatsApp do admin: botões `wa.me` (pago/enviado) — sem Cloud API. Número da loja: `NEXT_PUBLIC_WHATSAPP`.
Banners/SEO: admin em `/admin` (SEO + banners); ver `docs/SEO-BANNERS.md`.
Multi-admin: em `/admin` (seção Administradores) — criar/listar/desativar outros admins (`GET/POST /admin/admins`, `PATCH /admin/admins/:id/status`).
Chat IA: widget em http://localhost:3000 e POST /api/v1/chat. Env opcional OPENAI_API_KEY, CHAT_API_BASE, CHAT_MODEL. Sem chave = FAQ + WhatsApp. Ver docs/CHAT.md.
