# Arquitetura — SCH-001

## Princípio

Site e App Android consomem a mesma API `/api/v1` e o mesmo PostgreSQL.

A vitrine Netlify atual continua publicada. Este monorepo é a fundação da plataforma real.

## Camadas

1. Clientes: Web Next.js, Admin, Android
2. API NestJS (`/api/v1`)
3. PostgreSQL + Redis
4. Object storage (R2) — módulo futuro
5. Provedores (MP, Melhor Envio, WhatsApp) — módulos futuros; neste módulo só interfaces/tabelas

## Papéis

- `customer` — loja
- `admin` — `/admin`
- `seller` — reservado para marketplace (V4); sem uso agora

## Ambientes

development / staging / production via `APP_ENV`.
Secrets apenas em variáveis de ambiente.
