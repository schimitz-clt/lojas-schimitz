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

## Auth cookie-first (refresh)

Em hosts **não-locais** (ex.: `lojasschimitz.com.br`, WebView Android):

- Todo `fetch` da API usa `credentials: 'include'`.
- Refresh fica no cookie HttpOnly `sch_refresh` (proxy same-origin); **não** grava refresh em `localStorage`.
- Se ainda existir `sch_refresh` no `localStorage` (legado), o body de `/auth/refresh` e `/auth/logout` continua enviando o token (dual-mode).

Em **localhost** / `127.0.0.1` a API costuma ser cross-origin (`:3001`): o refresh ainda é persistido em `localStorage` e enviado no body.

Access JWT curto e dados de usuário continuam em `localStorage` em todos os ambientes.


## www → apex

`src/middleware.ts` faz 301 `www.lojasschimitz.com.br` → `https://lojasschimitz.com.br` com o mesmo path/query.
Isso só vale quando o Host www chega no Next. Sem custom domain www no Railway (ou redirect na Cloudflare),
o edge continua respondendo 404 `Application not found`. Ver `docs/DEPLOY.md`.
