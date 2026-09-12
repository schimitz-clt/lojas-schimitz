# Arquitetura — SCH-001

## Princípio

Site e App Android consomem a mesma API `/api/v1` e o mesmo PostgreSQL.

A vitrine Netlify atual continua publicada. Este monorepo é a fundação da plataforma real.

## Camadas

1. Clientes: Web Next.js, Admin, Android
2. API NestJS (`/api/v1`)
3. PostgreSQL + Redis
4. Object storage (R2) — módulo futuro; interim: upload admin em disco (`UPLOADS_DIR`, volume Railway) servido em `/api/v1/uploads`
5. Provedores (MP, Melhor Envio) — Mercado Pago ativo; WhatsApp hoje é clique-para-conversar (`wa.me`, ver `docs/WHATSAPP.md`). Cloud API (Meta) é módulo futuro — sem tokens neste repo.

## Papéis

- `customer` — loja
- `admin` — `/admin`
- `seller` — reservado para marketplace (V4); sem uso agora

## Ambientes

development / staging / production via `APP_ENV`.
Secrets apenas em variáveis de ambiente.

Chat: widget na loja + POST /chat. Detalhes em docs/CHAT.md. LLM (OpenAI) é **opcional** — sem chave o endpoint responde FAQ + catálogo + WhatsApp.
