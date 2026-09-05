# Banners da home + SEO (SCH-006)

## Admin (`/admin`)

1. Entre com conta `role=admin`.
2. **SEO da loja** — título, descrição meta e imagem Open Graph opcional. Salvar.
3. **Banners da home** — enviar imagem (mesmo upload `/admin/uploads` → volume `UPLOADS_DIR` / `PUBLIC_API_URL`), título/alt, link opcional (`https://` ou `/caminho`), ativar. Use ↑↓ para reordenar, Desativar/Excluir conforme necessário.

## Público

- Home mostra banners ativos em carrossel (`GET /store/banners`).
- Meta site-wide vem de `GET /store/settings` (layout Next).
- Páginas de produto: `title`/`description`/OG a partir do nome e descrição do produto.
- `robots.txt` e `sitemap.xml` usam `NEXT_PUBLIC_SITE_URL` e listam produtos/categorias.

## Env

- `NEXT_PUBLIC_SITE_URL` — URL canônica da loja (SEO, OG, sitemap).
- `UPLOADS_DIR` / `PUBLIC_API_URL` — iguais aos uploads de produto (ex.: `/data/uploads` no Railway).

## Multi-admin

Não incluso neste PR. O schema já tem `UserRole.admin`; segundo admin = criar/atualizar usuário com `role=admin` (seed/`ADMIN_EMAIL` ou SQL). UI de gestão de usuários fica como follow-up.
