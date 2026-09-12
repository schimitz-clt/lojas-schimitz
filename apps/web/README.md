# apps/web — Loja Next.js (V1)

Front-end da loja própria. Consome `GET/POST /api/v1`.

A vitrine Netlify **permanece no ar**. Este app é a loja nova, para subir em paralelo.

## Como rodar

Na raiz do monorepo, a API precisa estar no ar (`localhost:3001`).

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

Abra http://localhost:3000

## Páginas

- `/` catálogo
- `/departamento/[slug]`
- `/produto/[slug]`
- `/carrinho`
- `/entrar` `/cadastro` `/conta`
- `/favoritos` `/pedidos`
- `/admin` (role admin)


## Proxy same-origin (`/api/v1`)

Em produção o browser chama **`/api/v1/*`** (mesma origem que a loja) para cookies HttpOnly `sch_refresh` funcionarem. O Route Handler em `src/app/api/v1/[[...path]]` encaminha para a API Nest.

Variáveis:

- `NEXT_PUBLIC_API_URL` — URL absoluta da API (SSR + local). Continua apontando para Railway/`localhost:3001`.
- `API_PROXY_TARGET` — origem da API **sem** `/api/v1` (ex.: `https://lojas-schimitz-production.up.railway.app`). Se omitida, deriva de `NEXT_PUBLIC_API_URL`.

Webhooks Mercado Pago permanecem na URL Railway da API (não passam por este proxy).
