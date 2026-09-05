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
