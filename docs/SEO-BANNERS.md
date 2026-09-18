# Banners da home + SEO (SCH-006)

## Admin (`/admin/vitrine`)

1. Entre com conta `role=admin`.
2. **SEO da loja** — título, descrição meta e imagem Open Graph opcional. Salvar.
3. **Banners da home** — até **5** slides. Enviar imagem (mesmo upload `/admin/uploads` → volume `UPLOADS_DIR` / `PUBLIC_API_URL`), título/alt, link opcional (`https://` ou `/caminho`), ativar. Use ↑↓ para reordenar, Desativar/Excluir conforme necessário.
4. A home mostra **um banner por vez** (swipe no celular, setas no desktop, bolinhas embaixo). Com só 1 banner, as setas e bolinhas ficam ocultas.
5. Sem banners ativos, a home mantém o hero promocional atual (PIX / 3x / frete POA) para a vitrine não ficar vazia.

## Depois do deploy — como o dono troca os banners

1. Abra `/admin` → **Vitrine**.
2. **Criar banner**: enviar a arte (JPG/PNG/WebP) ou colar a URL, link do clique (ex.: `/departamento/ofertas`), marcar **Banner ativo**.
3. **Editar / reordenar**: Editar, ↑↓, Desativar ou Excluir.
4. Limite de 5. Para um sexto, edite ou exclua um existente.
5. Recarregue a home (ou espere ~1 min) para ver o carrossel.

## Público

- Home mostra banners ativos em carrossel com scroll-snap (`GET /store/banners`, no máximo 5).
- Meta site-wide vem de `GET /store/settings` (layout Next).
- Páginas de produto: `title`/`description`/OG a partir do nome e descrição do produto.
- `robots.txt` e `sitemap.xml` usam `NEXT_PUBLIC_SITE_URL` e listam produtos/categorias.

## Env

- `NEXT_PUBLIC_SITE_URL` — URL canônica da loja (SEO, OG, sitemap).
- `UPLOADS_DIR` / `PUBLIC_API_URL` — iguais aos uploads de produto (ex.: `/data/uploads` no Railway).

## Multi-admin

Não incluso neste PR. O schema já tem `UserRole.admin`; segundo admin = criar/atualizar usuário com `role=admin` (seed/`ADMIN_EMAIL` ou SQL). UI de gestão de usuários fica como follow-up.
