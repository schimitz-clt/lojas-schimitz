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
- `/conta` `/conta/salvos` `/favoritos` `/pedidos`
- `/admin` (role admin)


## Proxy same-origin (`/api/v1`)

Em produção o browser chama **`/api/v1/*`** (mesma origem que a loja) para cookies HttpOnly `sch_refresh` funcionarem. O Route Handler em `src/app/api/v1/[[...path]]` encaminha para a API Nest.

Variáveis:

- `NEXT_PUBLIC_API_URL` — URL absoluta da API (SSR + local). Continua apontando para Railway/`localhost:3001`.
- `API_PROXY_TARGET` — origem da API **sem** `/api/v1` (ex.: `https://lojas-schimitz-production.up.railway.app`). Se omitida, deriva de `NEXT_PUBLIC_API_URL`.

Webhooks Mercado Pago permanecem na URL Railway da API (não passam por este proxy).

## Auth cookie-first (refresh + access)

Em hosts **não-locais** (ex.: `lojasschimitz.com.br`, WebView Android):

- Todo `fetch` da API usa `credentials: 'include'`.
- Refresh e access ficam nos cookies HttpOnly `sch_refresh` / `sch_access` (proxy same-origin); **não** grava JWTs em `localStorage`/`sessionStorage`.
- Body de `/auth/refresh` e `/auth/logout` é `{}` nestes hosts.
- JSON sem `refreshToken` (`REFRESH_JSON_TOKEN_ENABLED=false` na API) é válido: a sessão segue no cookie.
- Cadastro (`POST /auth/register`) devolve mensagem genérica (anti-enumeração) e **não** abre sessão — o cliente faz login em seguida.

Em **localhost** / `127.0.0.1` a API costuma ser cross-origin (`:3001`): access/refresh ficam só na memória da aba e o refresh pode ir no body. Recarregar a página no localhost pede login de novo se o cookie não colar.

O perfil `sch_user` (id/nome/e-mail/role, não é JWT) continua em `localStorage` para a UI.


## www → apex

`src/middleware.ts` faz 301 `www.lojasschimitz.com.br` → `https://lojasschimitz.com.br` com o mesmo path/query.
Isso só vale quando o Host www chega no Next. Sem custom domain www no Railway (ou redirect na Cloudflare),
o edge continua respondendo 404 `Application not found`. Ver `docs/DEPLOY.md`.
